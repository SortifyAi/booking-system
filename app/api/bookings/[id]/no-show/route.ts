// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { normalizeEmail } from '@/lib/email-domain'
import { countNoShowIncidents } from '@/lib/customer-email'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

    const { id } = await params
    const client = await createClient()
    const { data: booking, error: bookingError } = await client
      .from('bookings')
      .select('id, organization_id, customer_email, group_id')
      .eq('id', id)
      .maybeSingle() as any

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
    }

    const { data: membership } = await client
      .from('user_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', booking.organization_id)
      .maybeSingle() as any

    if (!membership) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })

    let updateQuery = client
      .from('bookings')
      .update({ status: 'no_show' })
      .eq('organization_id', booking.organization_id)

    updateQuery = booking.group_id
      ? updateQuery.eq('group_id', booking.group_id)
      : updateQuery.eq('id', booking.id)

    const { data: changed, error: updateError } = await updateQuery.select('id') as any
    if (updateError) throw updateError

    const normalizedEmail = normalizeEmail(booking.customer_email || '')
    const { data: noShows, error: historyError } = await client
      .from('bookings')
      .select('id, group_id')
      .eq('organization_id', booking.organization_id)
      .eq('customer_email', normalizedEmail)
      .eq('status', 'no_show') as any

    if (historyError) throw historyError

    return NextResponse.json({
      changedIds: (changed || []).map((row: any) => row.id),
      noShowCount: countNoShowIncidents(noShows || []),
    })
  } catch (error) {
    console.error('Failed to mark booking as no-show:', error)
    return NextResponse.json({ error: 'Termin konnte nicht aktualisiert werden' }, { status: 500 })
  }
}
