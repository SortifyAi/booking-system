// @ts-nocheck
/**
 * Public, login-less access to a single booking via its secret manage_token.
 * GET returns only the data needed for the customer's "manage appointment" page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCancellationCutoffHours, canCancelBooking, getAllowReschedule } from '@/lib/booking-policy'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
  }

  const supabase = createServiceClient()

  const bookingSelect = `
      id, customer_name, start_time, end_time, status, metadata, group_id,
      offering_id, location_id, resource_id,
      offerings(name, duration_minutes, price_cents),
      locations(name, address, timezone),
      resources(name),
      organizations(name, settings, logo_url)
    `

  // Der Link zeigt auf genau eine Buchung; gehört sie zu einer Sammelbuchung
  // (group_id), laden wir alle Geschwister-Zeilen dazu.
  const { data: primary, error } = await supabase
    .from('bookings')
    .select(bookingSelect)
    .eq('manage_token', token)
    .maybeSingle()

  if (error || !primary) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  }

  let rows: any[] = [primary]
  if (primary.group_id) {
    const { data: siblings } = await supabase
      .from('bookings')
      .select(bookingSelect)
      .eq('group_id', primary.group_id)
      .order('start_time', { ascending: true })
    if (siblings && siblings.length > 0) rows = siblings
  }

  const booking: any = rows[0]
  const isGroup = rows.length > 1

  const cutoffHours = getCancellationCutoffHours(booking.organizations?.settings)
  const isCancelled = booking.status === 'cancelled'
  // Both cancelling and rescheduling are gated by the same cutoff window.
  const withinCutoff = canCancelBooking(booking.start_time, cutoffHours)
  const canCancel = !isCancelled && withinCutoff
  const allowReschedule = getAllowReschedule(booking.organizations?.settings)
  // Online-Verschieben ist im MVP nur für Einzelbuchungen erlaubt.
  const canReschedule = !isCancelled && allowReschedule && withinCutoff && !isGroup

  // Positionen der (Sammel-)Buchung inkl. Zusatzleistungen.
  const items = rows.map((r: any) => ({
    serviceName: r.offerings?.name ?? null,
    staffName: r.resources?.name ?? null,
    durationMinutes: r.offerings?.duration_minutes ?? null,
    priceCents: r.offerings?.price_cents ?? null,
    addons: Array.isArray(r.metadata?.addons)
      ? r.metadata.addons.map((a: any) => ({ name: a.name, priceCents: a.priceCents ?? null }))
      : [],
  }))

  // Summenpreis über alle Positionen + Zusatzleistungen.
  const totalPriceCents = items.reduce(
    (sum: number, it: any) =>
      sum + (it.priceCents ?? 0) + it.addons.reduce((s: number, a: any) => s + (a.priceCents ?? 0), 0),
    0
  )

  return NextResponse.json({
    booking: {
      customerName: booking.customer_name,
      startTime: booking.start_time,
      endTime: booking.end_time,
      status: booking.status,
      serviceName: booking.offerings?.name ?? null,
      priceCents: booking.offerings?.price_cents ?? null,
      durationMinutes: booking.offerings?.duration_minutes ?? null,
      staffName: booking.resources?.name ?? null,
      locationName: booking.locations?.name ?? null,
      locationAddress: booking.locations?.address ?? null,
      timezone: booking.locations?.timezone ?? null,
      organizationName: booking.organizations?.name ?? null,
      organizationLogoUrl: booking.organizations?.logo_url ?? null,
      isGroup,
      items,
      addons: items[0]?.addons ?? [],
      totalPriceCents,
      // Needed by the customer-facing reschedule slot picker.
      offeringId: booking.offering_id,
      locationId: booking.location_id,
      resourceId: booking.resource_id,
    },
    canCancel,
    canReschedule,
    allowReschedule,
    cutoffHours,
  })
}
