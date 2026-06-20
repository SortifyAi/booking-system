// @ts-nocheck
/**
 * Login-less rescheduling of a booking via its secret manage_token.
 *
 * Keeps the same service, location and staff member; only the start/end move.
 * Gated by the org's `allowReschedule` flag and the (shared) cancellation
 * cutoff. Re-validates the new slot exactly like the create flow: future,
 * not on a closed day, and free for the assigned staff (with the DB exclusion
 * constraint as the atomic backstop).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getCancellationCutoffHours,
  canCancelBooking,
  getAllowReschedule,
  isFutureBookingStart,
  BOOKING_IN_PAST_ERROR,
} from '@/lib/booking-policy'
import { resolveClosedReason } from '@/lib/holidays'
import { utcToZonedDateStr } from '@/lib/timezone'
import { sendBookingUpdate } from '@/lib/email'
import { buildManageUrl } from '@/lib/booking-token'

const rescheduleSchema = z.object({
  startTime: z.string().datetime(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const parsed = rescheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }
  const { startTime } = parsed.data

  const supabase = createServiceClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, status, start_time, end_time, organization_id, location_id,
      offering_id, resource_id, customer_name, customer_email, metadata, group_id,
      offerings(name, duration_minutes),
      locations(name, address, timezone, settings),
      organizations(name, settings)
    `)
    .eq('manage_token', token)
    .maybeSingle()

  if (error || !booking) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  }

  // Sammelbuchungen (mehrere Personen) können online nicht verschoben werden.
  if (booking.group_id) {
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', booking.group_id)
    if ((count || 0) > 1) {
      return NextResponse.json(
        { error: 'Sammelbuchungen können online nicht verschoben werden. Bitte kontaktieren Sie uns.', reason: 'group' },
        { status: 403 }
      )
    }
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Stornierte Termine können nicht verschoben werden.', code: 'CANCELLED' },
      { status: 409 }
    )
  }

  if (!getAllowReschedule(booking.organizations?.settings)) {
    return NextResponse.json(
      { error: 'Online-Verschiebung ist für diesen Anbieter nicht möglich.', reason: 'disabled' },
      { status: 403 }
    )
  }

  // Same cutoff as cancellation, applied to the *current* appointment time.
  const cutoffHours = getCancellationCutoffHours(booking.organizations?.settings)
  if (!canCancelBooking(booking.start_time, cutoffHours)) {
    return NextResponse.json(
      { error: 'Online-Verschiebung nicht mehr möglich', reason: 'cutoff', cutoffHours },
      { status: 403 }
    )
  }

  if (!isFutureBookingStart(startTime)) {
    return NextResponse.json(
      { error: BOOKING_IN_PAST_ERROR, code: 'BOOKING_IN_PAST' },
      { status: 400 }
    )
  }

  // Duration is fixed by the service (+ any add-ons booked with it); derive the
  // new end server-side so a tampered client cannot shrink/extend the appointment.
  const serviceDuration = booking.offerings?.duration_minutes
  if (!serviceDuration) {
    return NextResponse.json({ error: 'Termin kann nicht verschoben werden.' }, { status: 400 })
  }
  const addonDuration = Array.isArray(booking.metadata?.addons)
    ? booking.metadata.addons.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0)
    : 0
  const durationMinutes = serviceDuration + addonDuration
  const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString()

  // Reject moves onto a closed day (public holiday or owner exception).
  const tz = booking.locations?.timezone || 'Europe/Berlin'
  const newDate = utcToZonedDateStr(startTime, tz)
  const closedReason = await resolveClosedReason(booking.locations?.settings, newDate)
  if (closedReason) {
    return NextResponse.json({ error: closedReason, code: 'CLOSED' }, { status: 400 })
  }

  // Conflict check against the assigned staff member (or location-wide when the
  // booking has no resource), excluding this booking itself.
  let conflictQuery = supabase
    .from('bookings')
    .select('id')
    .eq('location_id', booking.location_id)
    .in('status', ['pending', 'confirmed'])
    .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)
    .neq('id', booking.id)

  if (booking.resource_id) {
    conflictQuery = conflictQuery.eq('resource_id', booking.resource_id)
  }

  const { data: conflicts, error: conflictError } = await conflictQuery.limit(1)
  if (conflictError) {
    return NextResponse.json({ error: 'Verschieben fehlgeschlagen' }, { status: 500 })
  }
  if (conflicts?.length) {
    return NextResponse.json(
      { error: 'Dieser Termin ist leider nicht mehr verfügbar.', code: 'SLOT_TAKEN' },
      { status: 409 }
    )
  }

  // Move the booking and clear reminder_sent so the new day gets a fresh reminder.
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ start_time: startTime, end_time: endTime, reminder_sent: null })
    .eq('id', booking.id)

  if (updateError) {
    // bookings_no_overlap exclusion constraint is the atomic backstop against a
    // concurrent booking grabbing the same slot for the same resource (23P01).
    if (updateError.code === '23P01') {
      return NextResponse.json(
        { error: 'Dieser Termin ist leider nicht mehr verfügbar.', code: 'SLOT_TAKEN' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Verschieben fehlgeschlagen' }, { status: 500 })
  }

  // Notify the customer (best effort – never block the reschedule on email).
  try {
    if (booking.customer_email) {
      await sendBookingUpdate({
        customerName: booking.customer_name,
        customerEmail: booking.customer_email,
        offeringName: booking.offerings?.name || 'Service',
        locationName: booking.locations?.name || 'Standort',
        locationAddress: booking.locations?.address || '',
        timeZone: tz,
        startTime,
        endTime,
        organizationName: booking.organizations?.name || 'Terminbuchung',
        manageUrl: buildManageUrl(token),
        manageToken: token,
        organizationId: booking.organization_id,
        bookingId: booking.id,
      })
    }
  } catch (e) {
    console.error('Failed to send reschedule email:', e)
  }

  return NextResponse.json({ success: true, startTime, endTime })
}
