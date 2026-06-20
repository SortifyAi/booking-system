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

const createCalendarShareSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  allowedResourceIds: z.array(z.string().uuid()).min(1),
})

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

async function getManageableOrganizationIds(client: any, userId: string) {
  const { data, error } = await client
    .from('user_organizations')
    .select('organization_id, role')
    .eq('user_id', userId)
    .in('role', shareManagerRoles)

  if (error) throw error
  return (data || []).map((row: any) => row.organization_id)
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

export async function GET() {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const client = await createClient()
    const organizationIds = await getManageableOrganizationIds(client, user.id)

    if (organizationIds.length === 0) {
      return NextResponse.json({ shares: [] })
    }

    const { data, error } = await client
      .from('calendar_share_links')
      .select('*')
      .in('organization_id', organizationIds)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ shares: (data || []).map(serializeCalendarShare) })
  } catch (error) {
    console.error('Calendar shares list error:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createCalendarShareSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validation.error.issues },
        { status: 400 }
      )
    }

    const client = await createClient()
    const organizationIds = await getManageableOrganizationIds(client, user.id)
    const organizationId = validation.data.organizationId || organizationIds[0]

    if (!organizationId || !organizationIds.includes(organizationId)) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    const resourceValidation = await validateStaffResourceIds(
      client,
      organizationId,
      validation.data.allowedResourceIds
    )
    if (resourceValidation.error) {
      return NextResponse.json({ error: resourceValidation.error }, { status: 400 })
    }

    const { data, error } = await client
      .from('calendar_share_links')
      .insert({
        organization_id: organizationId,
        name: validation.data.name,
        token: generateCalendarShareToken(),
        allowed_resource_ids: resourceValidation.resourceIds,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ share: serializeCalendarShare(data) }, { status: 201 })
  } catch (error) {
    console.error('Calendar share create error:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
