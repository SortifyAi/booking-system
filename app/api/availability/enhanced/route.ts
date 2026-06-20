// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/server/db'
import { AvailabilitySlot } from '@/types/models'
import { z } from 'zod'
import { parse, addMinutes, format } from 'date-fns'
import { BUSINESS_HOURS } from '@/lib/constants'
import { zonedTimeToUtc } from '@/lib/timezone'
import { resolveClosedReason, getExceptionWindow } from '@/lib/holidays'
import { buildDemoAvailability, isDemoLocationId, isDemoOfferingId } from '@/lib/public-demo'
import { isFutureBookingStart, withPastSlotsUnavailable } from '@/lib/booking-policy'
import { blockBlocksSlot } from '@/lib/block-availability'

const enhancedAvailabilitySchema = z.object({
  locationId: z.string().uuid(),
  offeringId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  staffId: z.string().uuid().optional(), // Specific staff member
  preferredStaffId: z.string().uuid().optional(), // Preferred staff member (smart mode)
  aggregated: z.boolean().optional(), // Show combined availability
  mode: z.enum(['smart']).optional(),
  duration: z.number().int().positive().optional(),
})

interface StaffAvailability {
  staffId: string
  staffName: string
  staffImageUrl?: string | null
  slots: AvailabilitySlot[]
  utilizationRate: number
  availableSlots: number
  totalSlots: number
  priority?: number
}

interface AggregatedAvailability {
  date: string
  totalCapacity: number
  bookedCapacity: number
  availableCapacity: number
  utilizationRate: number
  peakHours: string[]
  freeSlots: string[]
  status: 'green' | 'orange' | 'red' // green: >50% free, orange: 20-50% free, red: <20% free
  staffSummary: Array<{
    staffId: string
    staffName: string
    utilization: number
  }>
}

/**
 * GET /api/availability/enhanced
 * Get available time slots with staff filtering and aggregation
 * 
 * Query params:
 * - locationId: required
 * - offeringId: required
 * - date: required (YYYY-MM-DD)
 * - staffId: optional (filter by specific staff member)
 * - preferredStaffId: optional (preferred staff member for smart mode)
 * - aggregated: optional (show combined availability across staff)
 * - mode: optional (smart)
 * - duration: optional (override offering duration)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const validationData = {
      locationId: searchParams.get('locationId'),
      offeringId: searchParams.get('offeringId'),
      date: searchParams.get('date'),
      staffId: searchParams.get('staffId') || undefined,
      preferredStaffId: searchParams.get('preferredStaffId') || undefined,
      aggregated: searchParams.get('aggregated') === 'true',
      mode: searchParams.get('mode') || undefined,
      duration: searchParams.get('duration') ? parseInt(searchParams.get('duration')!) : undefined,
    }

    const validationResult = enhancedAvailabilitySchema.safeParse(validationData)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const {
      locationId,
      offeringId,
      date,
      staffId,
      preferredStaffId,
      aggregated,
      mode,
      duration: customDuration,
    } = validationResult.data
    const now = new Date()

    if (isDemoLocationId(locationId) && isDemoOfferingId(offeringId)) {
      const demoAvailability = buildDemoAvailability({
        date,
        offeringId,
        preferredStaffId: preferredStaffId || staffId,
        aggregated,
        mode,
      })

      if (demoAvailability.type === 'smart') {
        demoAvailability.preferredStaffAvailableSlots = withPastSlotsUnavailable(
          demoAvailability.preferredStaffAvailableSlots || [],
          now
        )
        if (
          demoAvailability.fallbackNextAvailable &&
          !isFutureBookingStart(demoAvailability.fallbackNextAvailable.startTime, now)
        ) {
          demoAvailability.fallbackNextAvailable = null
        }
      } else if (demoAvailability.type === 'aggregated') {
        demoAvailability.staffDetails = (demoAvailability.staffDetails || []).map((staff: any) => ({
          ...staff,
          slots: withPastSlotsUnavailable(staff.slots || [], now),
        }))
      }

      return NextResponse.json(demoAvailability)
    }

    const client = getSupabaseAdmin()

    // Get offering to determine duration
    const { data: offering, error: offeringError } = await client
      .from('offerings')
      .select('duration_minutes, id, name')
      .eq('id', offeringId)
      .single() as any

    if (offeringError || !offering) {
      return NextResponse.json(
        { error: 'Offering not found' },
        { status: 404 }
      )
    }

    const durationMinutes = customDuration || offering.duration_minutes

    // Get location (timezone, opening hours, org)
    const { data: location, error: locError } = await client
      .from('locations')
      .select('timezone, organization_id, settings')
      .eq('id', locationId)
      .single() as any

    if (locError || !location) {
      return NextResponse.json(
        { error: 'Standort nicht gefunden' },
        { status: 404 }
      )
    }

    const isSmartMode = mode === 'smart'
    const preferredId = preferredStaffId || staffId

    // Holidays (per Bundesland) and owner exceptions close the day or override
    // its hours. Resolve before the expensive staff/booking/block queries so a
    // closed day short-circuits. An exception always wins over the holiday calendar.
    const closedReason = await resolveClosedReason(location.settings, date)
    const exceptionWindow = getExceptionWindow(location.settings, date)
    if (closedReason) {
      if (isSmartMode) {
        return NextResponse.json({
          type: 'smart',
          date,
          preferredStaffId: preferredId || null,
          preferredStaffAvailableSlots: [],
          fallbackNextAvailable: null,
          reason: closedReason,
          closed: true,
          closedReason,
        })
      }
      if (aggregated) {
        return NextResponse.json({
          type: 'aggregated',
          date,
          aggregated: null,
          staffDetails: [],
          closed: true,
          closedReason,
        })
      }
      return NextResponse.json({
        type: preferredId ? 'individual' : 'multi',
        date,
        staffMember: null,
        staffAvailabilities: [],
        closed: true,
        closedReason,
      })
    }

    // For the first production test, every active staff member at the location
    // can perform every active offering.
    let staffQuery = client
      .from('resources')
      .select('*')
      .eq('location_id', locationId)
      .eq('type', 'staff')
      .eq('is_active', true)

    if (preferredId && !isSmartMode) {
      staffQuery = staffQuery.eq('id', preferredId)
    }

    const { data: staffMembersRaw, error: staffError } = await staffQuery as any

    if (staffError) throw staffError
    if (!staffMembersRaw || staffMembersRaw.length === 0) {
      return NextResponse.json(
        aggregated
          ? { error: 'No staff members found' }
          : { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    const staffMembers = staffMembersRaw.map((staff: any, idx: number) => ({
      ...staff,
      priority: idx,
    }))

    const dateObj = parse(date, 'yyyy-MM-dd', new Date())
    const dayOfWeek = dateObj.getDay()

    // Get schedules for the day
    const { data: schedules, error: schedError } = await client
      .from('schedules')
      .select('start_time, end_time, resource_id')
      .eq('location_id', locationId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .in('resource_id', staffMembers.map(s => s.id)) as any

    if (schedError) throw schedError

    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Get existing bookings for all staff members (used for conflict checks)
    const { data: bookings, error: bookError } = await client
      .from('bookings')
      .select('start_time, end_time, resource_id')
      .eq('location_id', locationId)
      .eq('offering_id', offeringId)
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString())
      .in('resource_id', staffMembers.map(s => s.id)) as any

    if (bookError) throw bookError

    // Count total bookings per staff for the whole day (for load-balancing priority)
    const { data: allDayBookings } = await client
      .from('bookings')
      .select('resource_id')
      .eq('location_id', locationId)
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .in('resource_id', staffMembers.map(s => s.id)) as any

    const bookingCountPerStaff = new Map<string, number>()
    staffMembers.forEach((s: any) => bookingCountPerStaff.set(s.id, 0))
    ;(allDayBookings || []).forEach((b: any) => {
      if (b.resource_id) {
        bookingCountPerStaff.set(b.resource_id, (bookingCountPerStaff.get(b.resource_id) ?? 0) + 1)
      }
    })

    // Get blocks overlapping the date. Overlap, nicht Containment: ein mehrtägiger
    // Block (z. B. Urlaub) startet vor und endet nach dem abgefragten Tag und muss
    // trotzdem gefunden werden.
    const { data: blocks, error: blockError } = await client
      .from('blocks')
      .select('start_time, end_time, resource_id')
      .lte('start_time', endOfDay.toISOString())
      .gte('end_time', startOfDay.toISOString()) as any

    if (blockError) throw blockError

    // Opening hours are wall-clock times in the location's timezone; the slots
    // must be built in that timezone, not the server's (see lib/timezone.ts).
    const timezone = location.timezone || 'Europe/Berlin'

    // Determine fallback schedule from location opening hours or BUSINESS_HOURS
    const openingHours: any[] = location.settings?.openingHours ?? []
    const todayHours = openingHours.find((h: any) => h.day === dayOfWeek)
    const fallbackSchedule = todayHours && !todayHours.closed && todayHours.open && todayHours.close
      ? { start_time: `${todayHours.open}:00`, end_time: `${todayHours.close}:00` }
      : { start_time: `${String(BUSINESS_HOURS.start).padStart(2, '0')}:00:00`, end_time: `${String(BUSINESS_HOURS.end).padStart(2, '0')}:00:00` }
    const locationClosedToday = todayHours?.closed === true

    // Helper function to generate slots for a staff member
    const generateSlotsForStaff = (
      staffMemberId: string,
      staffName: string,
      staffSchedules: any[]
    ): AvailabilitySlot[] => {
      const slots: AvailabilitySlot[] = []

      // A custom-hours exception forces the day open even if it is normally
      // closed (e.g. owner opens on a Sunday or public holiday).
      if (!exceptionWindow && locationClosedToday && (!staffSchedules || staffSchedules.length === 0)) return slots

      // Exception hours override schedules and opening hours for this date;
      // otherwise fall back to the staff schedule, then the location's hours.
      const effectiveSchedules = exceptionWindow
        ? [{ start_time: `${exceptionWindow.open}:00`, end_time: `${exceptionWindow.close}:00`, resource_id: staffMemberId }]
        : staffSchedules && staffSchedules.length > 0
          ? staffSchedules
          : [{ ...fallbackSchedule, resource_id: staffMemberId }]

      for (const schedule of effectiveSchedules) {
        const [startHour, startMin] = schedule.start_time.split(':').map(Number)
        const [endHour, endMin] = schedule.end_time.split(':').map(Number)

        let slotStart = zonedTimeToUtc(date, startHour, startMin, timezone)
        const dayEnd = zonedTimeToUtc(date, endHour, endMin, timezone)

        while (slotStart.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
          const slotEnd = addMinutes(slotStart, durationMinutes)

          // Check for conflicts with this staff's bookings
          let hasConflict = false

          if (bookings) {
            for (const booking of bookings) {
              if (booking.resource_id === staffMemberId) {
                const bookingStart = new Date(booking.start_time)
                const bookingEnd = new Date(booking.end_time)

                if (slotStart < bookingEnd && slotEnd > bookingStart) {
                  hasConflict = true
                  break
                }
              }
            }
          }

          // Check for blocks
          if (!hasConflict && blocks) {
            for (const block of blocks) {
              if (blockBlocksSlot(block, slotStart, slotEnd, staffMemberId)) {
                hasConflict = true
                break
              }
            }
          }

          slots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            available: !hasConflict && isFutureBookingStart(slotStart, now),
          })

          slotStart = addMinutes(slotStart, 30) // 30-minute intervals
        }
      }

      return slots
    }

    // Generate availability for each staff member
    const staffAvailabilities: StaffAvailability[] = []

    for (const staff of staffMembers) {
      const staffSchedules = schedules.filter(s => s.resource_id === staff.id)
      const slots = generateSlotsForStaff(staff.id, staff.name, staffSchedules)

      const totalSlots = slots.length
      const availableSlots = slots.filter(s => s.available).length

      staffAvailabilities.push({
        staffId: staff.id,
        staffName: staff.name,
        staffImageUrl: staff.image_url ?? null,
        slots: slots.map(s => ({
          startTime: s.startTime,
          endTime: s.endTime,
          available: s.available,
          staffId: staff.id,
          staffName: staff.name,
          staffImageUrl: staff.image_url ?? null,
        })),
        availableSlots,
        totalSlots,
        utilizationRate: totalSlots > 0 ? ((totalSlots - availableSlots) / totalSlots) * 100 : 0,
        priority: bookingCountPerStaff.get(staff.id) ?? 0,
      })
    }

    if (isSmartMode) {
      const preferredAvailability = preferredId
        ? staffAvailabilities.find(s => s.staffId === preferredId)
        : undefined

      const preferredStaffAvailableSlots = preferredAvailability
        ? preferredAvailability.slots.filter(s => s.available)
        : []

      let fallbackNextAvailable: {
        startTime: string
        endTime: string
        staffId: string
        staffName: string
        staffImageUrl?: string | null
      } | null = null
      let reason: string | null = null

      if (preferredId && preferredStaffAvailableSlots.length === 0) {
        if (!preferredAvailability) {
          reason = 'Preferred staff cannot perform selected offering'
        }
        const allAvailableSlots = staffAvailabilities.flatMap(s =>
          s.slots
            .filter(slot => slot.available)
            .map(slot => ({
              startTime: slot.startTime,
              endTime: slot.endTime,
              staffId: s.staffId,
              staffName: s.staffName,
              staffImageUrl: s.staffImageUrl ?? null,
              priority: s.priority ?? 0,
            }))
        )

        if (allAvailableSlots.length > 0) {
          allAvailableSlots.sort((a, b) => {
            if (a.startTime === b.startTime) {
              if (a.priority === b.priority) return a.staffName.localeCompare(b.staffName)
              return a.priority - b.priority
            }
            return a.startTime.localeCompare(b.startTime)
          })
          const earliest = allAvailableSlots[0]
          fallbackNextAvailable = {
            startTime: earliest.startTime,
            endTime: earliest.endTime,
            staffId: earliest.staffId,
            staffName: earliest.staffName,
            staffImageUrl: earliest.staffImageUrl ?? null,
          }
          if (!reason) reason = 'Preferred staff has no availability for selected date'
        } else {
          reason = 'No staff availability for selected date'
        }
      }

      return NextResponse.json({
        type: 'smart',
        date,
        preferredStaffId: preferredId || null,
        preferredStaffAvailableSlots,
        fallbackNextAvailable,
        reason,
      })
    }

    // Return single staff member availability
    if (preferredId && staffAvailabilities.length > 0 && !aggregated) {
      return NextResponse.json({
        type: 'individual',
        date,
        staffMember: staffAvailabilities[0],
      })
    }

    // Return aggregated availability
    if (aggregated) {
      const allSlots = staffAvailabilities.flatMap(s => s.slots)
      const totalAvailableSlots = staffAvailabilities.reduce((sum, s) => sum + s.availableSlots, 0)
      const totalSlots = staffAvailabilities.reduce((sum, s) => sum + s.totalSlots, 0)

      // Identify peak hours (hours with least availability)
      const hourMap = new Map<string, number>()
      allSlots.forEach(slot => {
        const hour = slot.startTime.substring(0, 13) + ':00Z' // Round to hour
        hourMap.set(hour, (hourMap.get(hour) || 0) + (slot.available ? 1 : 0))
      })

      const sortedHours = Array.from(hourMap.entries())
        .sort((a, b) => a[1] - b[1])
      const peakHours = sortedHours.slice(0, 3).map(([hour]) => hour)
      const freeSlots = sortedHours.slice(-3).map(([hour]) => hour)

      const utilizationRate = totalSlots > 0 ? ((totalSlots - totalAvailableSlots) / totalSlots) * 100 : 0
      const availabilityRate = 100 - utilizationRate

      let status: 'green' | 'orange' | 'red'
      if (availabilityRate > 50) status = 'green'
      else if (availabilityRate > 20) status = 'orange'
      else status = 'red'

      const aggregated: AggregatedAvailability = {
        date,
        totalCapacity: staffAvailabilities.length,
        bookedCapacity: staffAvailabilities.length - Math.ceil(totalAvailableSlots / (totalSlots || 1) * staffAvailabilities.length),
        availableCapacity: Math.floor(totalAvailableSlots / (totalSlots || 1) * staffAvailabilities.length),
        utilizationRate,
        peakHours,
        freeSlots,
        status,
        staffSummary: staffAvailabilities.map(s => ({
          staffId: s.staffId,
          staffName: s.staffName,
          utilization: s.utilizationRate,
        })),
      }

      return NextResponse.json({
        type: 'aggregated',
        aggregated,
        staffDetails: staffAvailabilities,
      })
    }

    // Default: return all staff availabilities
    return NextResponse.json({
      type: 'multi',
      date,
      staffAvailabilities,
    })
  } catch (error) {
    console.error('Error calculating enhanced availability:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
