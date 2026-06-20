// @ts-nocheck
/**
 * GET /api/availability/cart
 *
 * Verfügbarkeit für eine Sammelbuchung mehrerer Personen, die PARALLEL starten.
 * Jede Warenkorb-Position braucht zur selben Startzeit einen eigenen, für ihre
 * Dauer freien Mitarbeiter. Es werden nur Slots angeboten, an denen genug
 * Mitarbeiter gleichzeitig frei sind, um alle Positionen distinct zuzuweisen.
 *
 * Query params:
 * - locationId: required (uuid)
 * - date: required (YYYY-MM-DD)
 * - durations: required, kommagetrennte Minuten je Position, z.B. "45,45,120"
 *              (inkl. Zusatzleistungen)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/server/db'
import { z } from 'zod'
import { parse, addMinutes } from 'date-fns'
import { BUSINESS_HOURS } from '@/lib/constants'
import { zonedTimeToUtc } from '@/lib/timezone'
import { resolveClosedReason, getExceptionWindow } from '@/lib/holidays'
import { isFutureBookingStart } from '@/lib/booking-policy'

const cartAvailabilitySchema = z.object({
  locationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durations: z.array(z.number().int().positive()).min(1),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const durationsRaw = (searchParams.get('durations') || '')
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => Number.isFinite(d) && d > 0)

    const validationResult = cartAvailabilitySchema.safeParse({
      locationId: searchParams.get('locationId'),
      date: searchParams.get('date'),
      durations: durationsRaw,
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { locationId, date, durations } = validationResult.data
    const now = new Date()

    const client = getSupabaseAdmin()

    // Location (timezone, opening hours)
    const { data: location, error: locError } = await client
      .from('locations')
      .select('timezone, organization_id, settings')
      .eq('id', locationId)
      .single() as any

    if (locError || !location) {
      return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
    }

    const timezone = location.timezone || 'Europe/Berlin'

    // Holidays / owner exceptions close the day or override its hours.
    const closedReason = await resolveClosedReason(location.settings, date)
    const exceptionWindow = getExceptionWindow(location.settings, date)
    if (closedReason) {
      return NextResponse.json({ type: 'cart', date, slots: [], closed: true, closedReason })
    }

    // Active staff at the location – every staff member can perform every offering.
    const { data: staffMembers, error: staffError } = await client
      .from('resources')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('type', 'staff')
      .eq('is_active', true) as any

    if (staffError) throw staffError
    if (!staffMembers || staffMembers.length === 0) {
      return NextResponse.json({ type: 'cart', date, slots: [] })
    }

    const staffIds = staffMembers.map((s: any) => s.id)
    const dateObj = parse(date, 'yyyy-MM-dd', new Date())
    const dayOfWeek = dateObj.getDay()

    const { data: schedules, error: schedError } = await client
      .from('schedules')
      .select('start_time, end_time, resource_id')
      .eq('location_id', locationId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .in('resource_id', staffIds) as any

    if (schedError) throw schedError

    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // ALL bookings for these staff that day (no offering filter – a parallel
    // person must not be double-booked regardless of the booked service).
    const { data: bookings, error: bookError } = await client
      .from('bookings')
      .select('start_time, end_time, resource_id')
      .eq('location_id', locationId)
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', startOfDay.toISOString())
      .lte('end_time', endOfDay.toISOString())
      .in('resource_id', staffIds) as any

    if (bookError) throw bookError

    // Overlap, nicht Containment: ein mehrtägiger Block (z. B. Urlaub) startet vor
    // und endet nach dem abgefragten Tag und muss trotzdem gefunden werden.
    const { data: blocks, error: blockError } = await client
      .from('blocks')
      .select('start_time, end_time, resource_id')
      .lte('start_time', endOfDay.toISOString())
      .gte('end_time', startOfDay.toISOString()) as any

    if (blockError) throw blockError

    // Fallback schedule from location opening hours (same logic as enhanced route).
    const openingHours: any[] = location.settings?.openingHours ?? []
    const todayHours = openingHours.find((h: any) => h.day === dayOfWeek)
    const fallbackSchedule = todayHours && !todayHours.closed && todayHours.open && todayHours.close
      ? { start_time: `${todayHours.open}:00`, end_time: `${todayHours.close}:00` }
      : { start_time: `${String(BUSINESS_HOURS.start).padStart(2, '0')}:00:00`, end_time: `${String(BUSINESS_HOURS.end).padStart(2, '0')}:00:00` }
    const locationClosedToday = todayHours?.closed === true

    // Per staff: working windows (UTC) + busy intervals (bookings, applicable blocks).
    const toUtcWindow = (startStr: string, endStr: string) => {
      const [sh, sm] = startStr.split(':').map(Number)
      const [eh, em] = endStr.split(':').map(Number)
      return { start: zonedTimeToUtc(date, sh, sm, timezone), end: zonedTimeToUtc(date, eh, em, timezone) }
    }

    const staffState = staffMembers.map((staff: any) => {
      const staffSchedules = (schedules || []).filter((s: any) => s.resource_id === staff.id)

      let windows: { start: Date; end: Date }[] = []
      if (exceptionWindow) {
        windows = [toUtcWindow(`${exceptionWindow.open}:00`, `${exceptionWindow.close}:00`)]
      } else if (staffSchedules.length > 0) {
        windows = staffSchedules.map((s: any) => toUtcWindow(s.start_time, s.end_time))
      } else if (!locationClosedToday) {
        windows = [toUtcWindow(fallbackSchedule.start_time, fallbackSchedule.end_time)]
      }

      const busy = [
        ...(bookings || [])
          .filter((b: any) => b.resource_id === staff.id)
          .map((b: any) => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
        ...(blocks || [])
          .filter((b: any) => !b.resource_id || b.resource_id === staff.id)
          .map((b: any) => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
      ]

      return { id: staff.id, windows, busy }
    })

    // Is a staff member free for the whole interval [t, t+d]?
    const isStaffFree = (state: any, slotStart: Date, durationMin: number) => {
      const slotEnd = addMinutes(slotStart, durationMin)
      const fitsWindow = state.windows.some(
        (w: any) => w.start.getTime() <= slotStart.getTime() && slotEnd.getTime() <= w.end.getTime()
      )
      if (!fitsWindow) return false
      for (const b of state.busy) {
        if (slotStart < b.end && slotEnd > b.start) return false
      }
      return true
    }

    // Candidate start times: union of every staff's 30-min grid within their windows.
    const minDuration = Math.min(...durations)
    const candidateStarts = new Map<number, Date>()
    for (const state of staffState) {
      for (const w of state.windows) {
        let t = new Date(w.start)
        while (t.getTime() + minDuration * 60000 <= w.end.getTime()) {
          candidateStarts.set(t.getTime(), new Date(t))
          t = addMinutes(t, 30)
        }
      }
    }

    const durationsDesc = [...durations].sort((a, b) => b - a)
    const distinctDurations = Array.from(new Set(durations))
    const maxDuration = durationsDesc[0]

    const slots: { startTime: string; endTime: string; available: boolean }[] = []

    for (const slotStart of Array.from(candidateStarts.values()).sort((a, b) => a.getTime() - b.getTime())) {
      if (!isFutureBookingStart(slotStart, now)) continue

      // Free-staff count per distinct duration at this start.
      const freeCount = new Map<number, number>()
      for (const d of distinctDurations) {
        freeCount.set(d, staffState.reduce((n: number, s: any) => n + (isStaffFree(s, slotStart, d) ? 1 : 0), 0))
      }

      // Nested-set Hall condition: durations sorted desc, position k (1-based)
      // needs at least k staff free for its duration to allow distinct assignment.
      let feasible = true
      for (let k = 0; k < durationsDesc.length; k++) {
        if ((freeCount.get(durationsDesc[k]) ?? 0) < k + 1) {
          feasible = false
          break
        }
      }

      if (feasible) {
        slots.push({
          startTime: slotStart.toISOString(),
          endTime: addMinutes(slotStart, maxDuration).toISOString(),
          available: true,
        })
      }
    }

    return NextResponse.json({ type: 'cart', date, slots })
  } catch (error) {
    console.error('Error calculating cart availability:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
