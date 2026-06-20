// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getUser } from '@/lib/supabase/server'
import {
  buildCalendarShareUrl,
  generateCalendarShareToken,
  normalizeAllowedResourceIds,
} from '@/lib/calendar-share'

const shareManagerRoles = ['owner', 'admin', 'manager']

const updateCalendarShareSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    allowedResourceIds: z.array(z.string().uuid()).min(1).optional(),
    isActive: z.boolean().optional(),
    regenerateToken: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.allowedResourceIds !== undefined ||
      value.isActive !== undefined ||
      value.regenerateToken === true,
    'Keine Änderungen übergeben'
  )

function serializeCalendarShare(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    token: row.token,
    url: buildCalendarShareUrl(row.token),
    allowedResourceIds: row.allowed_resource_ids || [],
    isActive: row.is_active,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function userCanManageOrganization(
  client: any,
  userId: string,
  organizationId: string
) {
  const { data, error } = await client
    .from('user_organizations')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .in('role', shareManagerRoles)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

async function validateStaffResourceIds(
  client: any,
  organizationId: string,
  resourceIds: string[]
) {
  const normalizedIds = normalizeAllowedResourceIds(resourceIds)
  if (normalizedIds.length === 0) {
    return { error: 'Bitte mindestens einen Mitarbeiter auswählen' }
  }

  const { data, error } = await client
    .from('resources')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('type', 'staff')
    .eq('is_active', true)
    .in('id', normalizedIds)

  if (error) throw error

  const foundIds = new Set((data || []).map((row: any) => row.id))
  const missingIds = normalizedIds.filter((id) => !foundIds.has(id))

  if (missingIds.length > 0) {
    return { error: 'Mindestens ein ausgewählter Mitarbeiter ist ungültig' }
  }

  return { resourceIds: normalizedIds }
}

async function loadShare(client: any, id: string) {
  const { data, error } = await client
    .from('calendar_share_links')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

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
    const validation = updateCalendarShareSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validation.error.issues },
        { status: 400 }
      )
    }

    const client = await createClient()
    const existing = await loadShare(client, id)
    if (!existing) {
      return NextResponse.json({ error: 'Freigabelink nicht gefunden' }, { status: 404 })
    }

    const canManage = await userCanManageOrganization(client, user.id, existing.organization_id)
    if (!canManage) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    const updatePayload: Record<string, unknown> = {}
    if (validation.data.name !== undefined) {
      updatePayload.name = validation.data.name
    }
    if (validation.data.isActive !== undefined) {
      updatePayload.is_active = validation.data.isActive
    }
    if (validation.data.regenerateToken === true) {
      updatePayload.token = generateCalendarShareToken()
    }
    if (validation.data.allowedResourceIds !== undefined) {
      const resourceValidation = await validateStaffResourceIds(
        client,
        existing.organization_id,
        validation.data.allowedResourceIds
      )
      if (resourceValidation.error) {
        return NextResponse.json({ error: resourceValidation.error }, { status: 400 })
      }
      updatePayload.allowed_resource_ids = resourceValidation.resourceIds
    }

    const { data, error } = await client
      .from('calendar_share_links')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ share: serializeCalendarShare(data) })
  } catch (error) {
    console.error('Calendar share update error:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { id } = await params
    const client = await createClient()
    const existing = await loadShare(client, id)
    if (!existing) {
      return NextResponse.json({ error: 'Freigabelink nicht gefunden' }, { status: 404 })
    }

    const canManage = await userCanManageOrganization(client, user.id, existing.organization_id)
    if (!canManage) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    const { error } = await client
      .from('calendar_share_links')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Calendar share delete error:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
