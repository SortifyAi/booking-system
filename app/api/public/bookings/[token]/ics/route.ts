// @ts-nocheck
/**
 * Public ICS download for a single booking (via its secret manage_token).
 * Linked from confirmation/reminder emails as the "Apple Kalender / Outlook"
 * button, so the customer can add the appointment to any ICS-aware client.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildIcsContent } from '@/lib/calendar-links'

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
      id, start_time, end_time,
      offerings(name),
      locations(name, address),
      organizations(name)
    `)
    .eq('manage_token', token)
    .maybeSingle()

  if (error || !booking) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  }

  const serviceName = booking.offerings?.name || 'Termin'
  const orgName = booking.organizations?.name || 'Terminbuchung'
  const locationParts = [booking.locations?.name, booking.locations?.address].filter(Boolean)

  const ics = buildIcsContent({
    uid: `booking-${booking.id}@bookanord`,
    title: `${serviceName} – ${orgName}`,
    description: `Ihr Termin bei ${orgName}.`,
    location: locationParts.join(', '),
    start: booking.start_time,
    end: booking.end_time,
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="termin-${booking.id}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
