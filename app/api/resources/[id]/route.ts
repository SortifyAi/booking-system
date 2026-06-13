// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { normalizeResourceImageUrl } from '@/lib/resource-images.mjs'
import { z } from 'zod'

const updateResourceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['staff', 'table', 'room', 'equipment']).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
  skills: z.array(z.string()).optional(),
})

function toResourceUpdate(data: z.infer<typeof updateResourceSchema>) {
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.type !== undefined) updates.type = data.type
  if (data.capacity !== undefined) updates.capacity = data.capacity
  if (data.isActive !== undefined) updates.is_active = data.isActive
  if (data.skills !== undefined) updates.skills = data.skills
  if (data.imageUrl !== undefined) updates.image_url = normalizeResourceImageUrl(data.imageUrl)
  return updates
}

/**
 * GET /api/resources/[id]
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

    const { data: resource, error } = await client
      .from('resources')
      .select('*')
      .eq('id', id)
      .single() as any

    if (error || !resource) {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }

    // Check access
    const { data: membership } = await client
      .from('user_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', resource.organization_id)
      .single() as any

    if (!membership) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    return NextResponse.json(resource)
  } catch (error) {
    console.error('Error fetching resource:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * PATCH /api/resources/[id]
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

    const validationResult = updateResourceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    let updates: Record<string, unknown>
    try {
      updates = toResourceUpdate(validationResult.data)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Ungültige Bild-URL' },
        { status: 400 }
      )
    }

    const client = await createClient()

    // Get resource
    const { data: resource, error: getError } = await client
      .from('resources')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !resource) {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }

    // Check permission
    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', resource.organization_id)
      .single() as any

    if (!['owner', 'admin', 'manager'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Update
    const { data: updated, error: updateError } = await client
      .from('resources')
      .update(updates)
      .eq('id', id)
      .select()
      .single() as any

    if (updateError) throw updateError
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating resource:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * DELETE /api/resources/[id]
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

    // Get resource
    const { data: resource, error: getError } = await client
      .from('resources')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !resource) {
      return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
    }

    // Check permission (admin/owner only)
    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', resource.organization_id)
      .single() as any

    if (!['owner', 'admin'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Delete
    const { error: deleteError } = await client
      .from('resources')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
