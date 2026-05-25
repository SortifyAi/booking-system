// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'

const updateBlockSchema = z.object({
  reason: z.string().optional(),
  type: z.enum(['vacation', 'sick', 'break', 'maintenance', 'other']).optional(),
})

/**
 * GET /api/blocks/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { id } = await params
    const client = await createClient()

    const { data: block, error } = await client
      .from('blocks')
      .select('*')
      .eq('id', id)
      .single() as any

    if (error || !block) {
      return NextResponse.json({ error: 'Block nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json(block)
  } catch (error) {
    console.error('Error fetching block:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * PATCH /api/blocks/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const validationResult = updateBlockSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const client = await createClient()

    // Get block
    const { data: block, error: getError } = await client
      .from('blocks')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !block) {
      return NextResponse.json({ error: 'Block nicht gefunden' }, { status: 404 })
    }

    // Check permission
    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', block.organization_id)
      .single() as any

    if (!['owner', 'admin', 'manager'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Update
    const { data: updated, error: updateError } = await client
      .from('blocks')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single() as any

    if (updateError) throw updateError
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating block:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * DELETE /api/blocks/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { id } = await params
    const client = await createClient()

    // Get block
    const { data: block, error: getError } = await client
      .from('blocks')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !block) {
      return NextResponse.json({ error: 'Block nicht gefunden' }, { status: 404 })
    }

    // Check permission (admin/owner only)
    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', block.organization_id)
      .single() as any

    if (!['owner', 'admin'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Delete
    const { error: deleteError } = await client
      .from('blocks')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting block:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}