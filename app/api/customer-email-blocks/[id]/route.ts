// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

    const { id } = await params
    const client = await createClient()
    const { data: block, error: blockError } = await client
      .from('customer_email_blocks')
      .select('id, organization_id, unblocked_at')
      .eq('id', id)
      .maybeSingle() as any

    if (blockError || !block) {
      return NextResponse.json({ error: 'Sperre nicht gefunden' }, { status: 404 })
    }
    if (block.unblocked_at) {
      return NextResponse.json({ error: 'Diese Sperre wurde bereits aufgehoben' }, { status: 409 })
    }

    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', block.organization_id)
      .maybeSingle() as any

    if (!['owner', 'admin'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    const { data: updated, error } = await client
      .from('customer_email_blocks')
      .update({
        unblocked_at: new Date().toISOString(),
        unblocked_by: user.id,
      })
      .eq('id', id)
      .is('unblocked_at', null)
      .select()
      .single() as any

    if (error) throw error
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to unblock customer email:', error)
    return NextResponse.json({ error: 'Sperre konnte nicht aufgehoben werden' }, { status: 500 })
  }
}
