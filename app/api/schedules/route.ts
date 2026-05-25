// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'

const createScheduleSchema = z.object({
  resourceId: z.string().uuid(),
  locationId: z.string().uuid(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Zeitformat HH:MM:SS'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Zeitformat HH:MM:SS'),
})

/**
 * GET /api/schedules
 * List schedules, optionally filtered by resource_id
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resource_id')

    const client = await createClient()

    // Get user's organizations
    const { data: userOrgs } = await client
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (!userOrgs?.length) {
      return NextResponse.json({ schedules: [] })
    }

    const orgIds = userOrgs.map(uo => uo.organization_id)

    // Get schedules
    let query = client
      .from('schedules')
      .select('*')
      .in('organization_id', orgIds)

    if (resourceId) {
      query = query.eq('resource_id', resourceId)
    }

    const { data: schedules, error } = await query.order('day_of_week', { ascending: true })

    if (error) throw error
    return NextResponse.json({ schedules: schedules || [] })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * POST /api/schedules
 * Create a new schedule
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = createScheduleSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { resourceId, locationId, dayOfWeek, startTime, endTime } = validationResult.data

    const client = await createClient()

    // Get resource to find organization
    const { data: resource, error: resourceError } = await client
      .from('resources')
      .select('organization_id')
      .eq('id', resourceId)
      .single() as any

    if (resourceError || !resource) {
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

    // Create schedule
    const { data: schedule, error: createError } = await client
      .from('schedules')
      .insert({
        organization_id: resource.organization_id,
        resource_id: resourceId,
        location_id: locationId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        is_active: true,
      })
      .select()
      .single() as any

    if (createError) throw createError
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('Error creating schedule:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}