// @ts-nocheck
/**
 * Public, login-less access to a single booking via its secret manage_token.
 * GET returns only the data needed for the customer's "manage appointment" page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCancellationCutoffHours, canCancelBooking } from '@/lib/booking-policy'

export async function GET(
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
      id, customer_name, start_time, end_time, status,
      offerings(name, duration_minutes, price_cents),
      locations(name, address),
      resources(name),
      organizations(name, settings, logo_url)
    `)
    .eq('manage_token', token)
    .maybeSingle()

  if (error || !booking) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  }

  const cutoffHours = getCancellationCutoffHours(booking.organizations?.settings)
  const isCancelled = booking.status === 'cancelled'
  const canCancel = !isCancelled && canCancelBooking(booking.start_time, cutoffHours)

  return NextResponse.json({
    booking: {
      customerName: booking.customer_name,
      startTime: booking.start_time,
      endTime: booking.end_time,
      status: booking.status,
      serviceName: booking.offerings?.name ?? null,
      priceCents: booking.offerings?.price_cents ?? null,
      staffName: booking.resources?.name ?? null,
      locationName: booking.locations?.name ?? null,
      locationAddress: booking.locations?.address ?? null,
      organizationName: booking.organizations?.name ?? null,
      organizationLogoUrl: booking.organizations?.logo_url ?? null,
    },
    canCancel,
    cutoffHours,
  })
}
