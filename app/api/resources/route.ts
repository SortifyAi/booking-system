// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { normalizeResourceImageUrl } from '@/lib/resource-images.mjs'
import { z } from 'zod'

const createResourceSchema = z.object({
  organizationId: z.string().uuid(),
  locationId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['staff', 'table', 'room', 'equipment']),
  capacity: z.number().int().positive().default(1),
  imageUrl: z.string().nullable().optional(),
})

/**
 * GET /api/resources
 * List resources for user's organizations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')

    const client = await createClient()

    // Get user's organizations
    const { data: userOrgs } = await client
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (!userOrgs?.length) {
      return NextResponse.json({ resources: [] })
    }

    const orgIds = userOrgs.map(uo => uo.organization_id)

    // Get resources
    let query = client
      .from('resources')
      .select('*')
      .in('organization_id', orgIds)

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data: resources, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ resources: resources || [] })
  } catch (error) {
    console.error('Error fetching resources:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * POST /api/resources
 * Create a new resource
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = createResourceSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { organizationId, locationId, name, type, capacity, imageUrl } = validationResult.data
    let normalizedImageUrl: string | null = null
    try {
      normalizedImageUrl = normalizeResourceImageUrl(imageUrl)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Ungültige Bild-URL' },
        { status: 400 }
      )
    }

    const client = await createClient()

    // Check permission
    const { data: membership, error: memberError } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single() as any

    if (memberError || !['owner', 'admin', 'manager'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Validate location belongs to organization
    const { data: location, error: locationError } = await client
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .eq('organization_id', organizationId)
      .single() as any

    if (locationError || !location) {
      return NextResponse.json({ error: 'Ungültiger Standort' }, { status: 400 })
    }

    const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      location_id: locationId,
      name,
      type,
      capacity,
    }
    if (normalizedImageUrl) {
      insertPayload.image_url = normalizedImageUrl
    }

    // Create resource
    const { data: resource, error: createError } = await client
      .from('resources')
      .insert(insertPayload)
      .select()
      .single() as any

    if (createError) throw createError
    return NextResponse.json(resource, { status: 201 })
  } catch (error) {
    console.error('Error creating resource:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
