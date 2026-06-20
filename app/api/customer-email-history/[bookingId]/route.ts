// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { normalizeEmail } from '@/lib/email-domain'
import { countNoShowIncidents } from '@/lib/customer-email'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

    const { bookingId } = await params
    const client = await createClient()
    const { data: booking, error: bookingError } = await client
      .from('bookings')
      .select('organization_id, customer_email')
      .eq('id', bookingId)
      .maybeSingle() as any

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
    }

    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', booking.organization_id)
      .maybeSingle() as any

    if (!membership) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })

    const normalizedEmail = normalizeEmail(booking.customer_email || '')
    const [{ data: noShows, error: noShowsError }, { data: activeBlock, error: blockError }] = await Promise.all([
      client
        .from('bookings')
        .select('id, group_id')
        .eq('organization_id', booking.organization_id)
        .eq('customer_email', normalizedEmail)
        .eq('status', 'no_show'),
      client
        .from('customer_email_blocks')
        .select('id')
        .eq('organization_id', booking.organization_id)
        .eq('normalized_email', normalizedEmail)
        .is('unblocked_at', null)
        .limit(1)
        .maybeSingle(),
    ]) as any

    if (noShowsError || blockError) throw noShowsError || blockError

    return NextResponse.json({
      email: normalizedEmail,
      noShowCount: countNoShowIncidents(noShows || []),
      isBlocked: Boolean(activeBlock),
      activeBlockId: activeBlock?.id || null,
      canManageBlock: ['owner', 'admin'].includes(membership.role),
    })
  } catch (error) {
    console.error('Failed to load customer email history:', error)
    return NextResponse.json({ error: 'Kundenhistorie konnte nicht geladen werden' }, { status: 500 })
  }
}
