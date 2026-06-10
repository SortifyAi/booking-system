// @ts-nocheck
/**
 * Login-less cancellation of a booking via its secret manage_token.
 * Enforces the organization's cancellation cutoff (default 24h before start).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCancellationCutoffHours, canCancelBooking } from '@/lib/booking-policy'
import { sendBookingCancellation } from '@/lib/email'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
  }

  const supabase = createServiceClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, status, start_time, end_time, customer_name, customer_email,
      offerings(name),
      locations(name, address),
      organizations(name, settings)
    `)
    .eq('manage_token', token)
    .maybeSingle()

  if (error || !booking) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  }

  // Idempotent: already cancelled is fine.
  if (booking.status === 'cancelled') {
    return NextResponse.json({ success: true, status: 'cancelled', alreadyCancelled: true })
  }

  const cutoffHours = getCancellationCutoffHours(booking.organizations?.settings)
  if (!canCancelBooking(booking.start_time, cutoffHours)) {
    return NextResponse.json(
      {
        error: 'Online-Stornierung nicht mehr möglich',
        reason: 'cutoff',
        cutoffHours,
      },
      { status: 403 }
    )
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('manage_token', token)

  if (updateError) {
    return NextResponse.json({ error: 'Stornierung fehlgeschlagen' }, { status: 500 })
  }

  // Notify the customer (best effort – never block the cancellation on email).
  try {
    if (booking.customer_email) {
      await sendBookingCancellation({
        customerName: booking.customer_name,
        customerEmail: booking.customer_email,
        offeringName: booking.offerings?.name || 'Service',
        locationName: booking.locations?.name || 'Standort',
        locationAddress: booking.locations?.address || '',
        startTime: booking.start_time,
        endTime: booking.end_time,
        organizationName: booking.organizations?.name || 'Terminbuchung',
      })
    }
  } catch (e) {
    console.error('Failed to send cancellation email:', e)
  }

  return NextResponse.json({ success: true, status: 'cancelled' })
}
