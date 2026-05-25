// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'

const createBlockSchema = z.object({
  locationId: z.string().uuid(),
  resourceId: z.string().uuid().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: z.string().optional(),
  type: z.enum(['vacation', 'sick', 'break', 'maintenance', 'other']).default('other'),
})

/**
 * GET /api/blocks
 * List blocks, optionally filtered by resource_id or location_id
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resource_id')
    const locationId = searchParams.get('location_id')

    const client = await createClient()

    // Get user's organizations
    const { data: userOrgs } = await client
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (!userOrgs?.length) {
      return NextResponse.json({ blocks: [] })
    }

    const orgIds = userOrgs.map(uo => uo.organization_id)

    // Get blocks
    let query = client
      .from('blocks')
      .select('*')
      .in('organization_id', orgIds)

    if (resourceId) {
      query = query.eq('resource_id', resourceId)
    }

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data: blocks, error } = await query.order('start_time', { ascending: true })

    if (error) throw error
    return NextResponse.json({ blocks: blocks || [] })
  } catch (error) {
    console.error('Error fetching blocks:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * POST /api/blocks
 * Create a new block (vacation, sick day, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = createBlockSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { locationId, resourceId, startTime, endTime, reason, type } = validationResult.data

    const client = await createClient()

    // Get location to find organization
    const { data: location, error: locationError } = await client
      .from('locations')
      .select('organization_id')
      .eq('id', locationId)
      .single() as any

    if (locationError || !location) {
      return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
    }

    // Check permission
    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', location.organization_id)
      .single() as any

    if (!['owner', 'admin', 'manager'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Create block
    const { data: block, error: createError } = await client
      .from('blocks')
      .insert({
        organization_id: location.organization_id,
        location_id: locationId,
        resource_id: resourceId || null,
        start_time: startTime,
        end_time: endTime,
        reason: reason || null,
        type,
      })
      .select()
      .single() as any

    if (createError) throw createError
    return NextResponse.json(block, { status: 201 })
  } catch (error) {
    console.error('Error creating block:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}