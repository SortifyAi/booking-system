// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/server/db'
import { AvailabilitySlot } from '@/types/models'
import { z } from 'zod'
import { parse, addMinutes, format } from 'date-fns'
import { BUSINESS_HOURS } from '@/lib/constants'
import { zonedTimeToUtc } from '@/lib/timezone'
import { resolveClosedReason, getExceptionWindow } from '@/lib/holidays'

const availabilitySchema = z.object({
  locationId: z.string().uuid(),
  offeringId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  duration: z.number().int().positive().optional(),
})

async function calculateAvailability(input: z.infer<typeof availabilitySchema>) {
  const { locationId, offeringId, date, duration: customDuration } = input

  const client = getSupabaseAdmin()

  // Get offering to determine duration
  const { data: offering, error: offeringError } = await client
    .from('offerings')
    .select('duration_minutes, id')
    .eq('id', offeringId)
    .single() as any

  if (offeringError || !offering) {
    return NextResponse.json(
      { error: 'Offering not found' },
      { status: 404 }
    )
  }

  const durationMinutes = customDuration || offering.duration_minutes

  // Get location (timezone + opening hours)
  const { data: location, error: locError } = await client
    .from('locations')
    .select('timezone, settings')
    .eq('id', locationId)
    .single() as any

  if (locError || !location) {
    return NextResponse.json(
      { error: 'Standort nicht gefunden' },
      { status: 404 }
    )
  }

  // Opening hours are wall-clock times in the location's timezone; the slots
  // must be built in that timezone, not the server's (see lib/timezone.ts).
  const timezone = location.timezone || 'Europe/Berlin'

  // Get schedules for the day
  const dateObj = parse(date, 'yyyy-MM-dd', new Date())
  const dayOfWeek = dateObj.getDay()

  // A public holiday (per Bundesland) or an owner exception can close the day or
  // override its hours; an exception always wins over the holiday calendar.
  const closedReason = await resolveClosedReason(location.settings, date)
  if (closedReason) {
    return NextResponse.json({ slots: [], closed: true, closedReason })
  }
  const exceptionWindow = getExceptionWindow(location.settings, date)

  const { data: schedules, error: schedError } = await client
    .from('schedules')
    .select('start_time, end_time')
    .eq('location_id', locationId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true) as any

  if (schedError) throw schedError

  // Fallback: Öffnungszeiten aus location.settings, sonst BUSINESS_HOURS
  let effectiveSchedules
  if (exceptionWindow) {
    // Custom hours for this date override schedules and opening hours.
    effectiveSchedules = [{ start_time: `${exceptionWindow.open}:00`, end_time: `${exceptionWindow.close}:00` }]
  } else if (schedules && schedules.length > 0) {
    effectiveSchedules = schedules
  } else {
    const openingHours: any[] = location.settings?.openingHours ?? []
    const todayHours = openingHours.find((h: any) => h.day === dayOfWeek)
    if (todayHours && !todayHours.closed && todayHours.open && todayHours.close) {
      effectiveSchedules = [{ start_time: `${todayHours.open}:00`, end_time: `${todayHours.close}:00` }]
    } else if (todayHours?.closed) {
      return NextResponse.json({ slots: [] })
    } else {
      effectiveSchedules = [{ start_time: `${String(BUSINESS_HOURS.start).padStart(2, '0')}:00:00`, end_time: `${String(BUSINESS_HOURS.end).padStart(2, '0')}:00:00` }]
    }
  }

  // Get existing bookings for the date
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const { data: bookings, error: bookError } = await client
    .from('bookings')
    .select('start_time, end_time')
    .eq('location_id', locationId)
    .eq('offering_id', offeringId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', startOfDay.toISOString())
    .lte('end_time', endOfDay.toISOString()) as any

  if (bookError) throw bookError

  // Get blocks for the date
  const { data: blocks, error: blockError } = await client
    .from('blocks')
    .select('start_time, end_time')
    .eq('location_id', locationId)
    .gte('start_time', startOfDay.toISOString())
    .lte('end_time', endOfDay.toISOString()) as any

  if (blockError) throw blockError

  // Generate available slots
  const slots: AvailabilitySlot[] = []

  for (const schedule of effectiveSchedules) {
    // Parse schedule times
    const [startHour, startMin] = schedule.start_time.split(':').map(Number)
    const [endHour, endMin] = schedule.end_time.split(':').map(Number)

    let slotStart = zonedTimeToUtc(date, startHour, startMin, timezone)
    const dayEnd = zonedTimeToUtc(date, endHour, endMin, timezone)

    while (slotStart.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
      const slotEnd = addMinutes(slotStart, durationMinutes)

      // Check for conflicts with bookings
      let hasConflict = false

      if (bookings) {
        for (const booking of bookings) {
          const bookingStart = new Date(booking.start_time)
          const bookingEnd = new Date(booking.end_time)

          if (slotStart < bookingEnd && slotEnd > bookingStart) {
            hasConflict = true
            break
          }
        }
      }

      // Check for blocks
      if (!hasConflict && blocks) {
        for (const block of blocks) {
          const blockStart = new Date(block.start_time)
          const blockEnd = new Date(block.end_time)

          if (slotStart < blockEnd && slotEnd > blockStart) {
            hasConflict = true
            break
          }
        }
      }

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        available: !hasConflict,
      })

      slotStart = addMinutes(slotStart, 30) // 30-minute intervals
    }
  }

  return NextResponse.json({ slots })
}

/**
 * GET /api/availability
 * Query params: location_id, offering_id, date (YYYY-MM-DD), duration (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id') || undefined
    const offeringId = searchParams.get('offering_id') || undefined
    const date = searchParams.get('date') || undefined
    const duration = searchParams.get('duration')
    const durationNumber = duration ? Number(duration) : undefined

    const validationResult = availabilitySchema.safeParse({
      locationId,
      offeringId,
      date,
      duration: durationNumber,
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    return calculateAvailability(validationResult.data)
  } catch (error) {
    console.error('Error calculating availability:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/availability
 * Get available time slots for a location/offering on a specific date
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validationResult = availabilitySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    return calculateAvailability(validationResult.data)
  } catch (error) {
    console.error('Error calculating availability:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
