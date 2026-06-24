// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { normalizeResourceImageUrl } from '@/lib/resource-images.mjs'
import { z } from 'zod'
import { mockOfferings } from '@/lib/mock-data'
import { isMockMode } from '@/lib/mock-mode'

const createOfferingSchema = z.object({
  organizationId: z.string().uuid(),
  locationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive().default(60),
  capacity: z.number().int().positive().default(1),
  priceCents: z.number().int().nonnegative().optional(),
  color: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  availableAsAddon: z.boolean().optional(),
  isStandaloneBookable: z.boolean().optional(),
})

/**
 * GET /api/offerings
 * List offerings for user's organizations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')
    
    // Return mock data in mock mode
    if (isMockMode()) {
      let data = mockOfferings;
      if (locationId) {
        data = mockOfferings.filter(off => off.location_id === locationId);
      }
      return NextResponse.json({ offerings: data });
    }
    
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const client = await createClient()

    // Get user's organizations
    const { data: userOrgs } = await client
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (!userOrgs?.length) {
      return NextResponse.json({ offerings: [] })
    }

    const orgIds = userOrgs.map(uo => uo.organization_id)

    // Get offerings
    let query = client
      .from('offerings')
      .select('*')
      .in('organization_id', orgIds)

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data: offerings, error } = await query
      .order('available_as_addon', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (error) throw error
    return NextResponse.json({ offerings: offerings || [] })
  } catch (error) {
    console.error('Error fetching offerings:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * POST /api/offerings
 * Create a new offering
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = createOfferingSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const {
      organizationId,
      locationId,
      name,
      description,
      durationMinutes,
      capacity,
      priceCents,
      color,
      imageUrl,
      availableAsAddon,
      isStandaloneBookable,
    } = validationResult.data
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

    const addonGroup = availableAsAddon ?? false
    const { data: lastOffering, error: orderError } = await client
      .from('offerings')
      .select('sort_order')
      .eq('location_id', locationId)
      .eq('available_as_addon', addonGroup)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle() as any

    if (orderError) throw orderError

    const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      location_id: locationId,
      name,
      description,
      duration_minutes: durationMinutes,
      capacity,
      price_cents: priceCents || null,
      color,
      available_as_addon: addonGroup,
      is_standalone_bookable: isStandaloneBookable ?? true,
      sort_order: (lastOffering?.sort_order ?? 0) + 1,
    }
    if (normalizedImageUrl) {
      insertPayload.image_url = normalizedImageUrl
    }

    // Create offering
    const { data: offering, error: createError } = await client
      .from('offerings')
      .insert(insertPayload)
      .select()
      .single() as any

    if (createError) throw createError
    return NextResponse.json(offering, { status: 201 })
  } catch (error) {
    console.error('Error creating offering:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
