// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'

const updateScheduleSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/schedules/[id]
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

    const { data: schedule, error } = await client
      .from('schedules')
      .select('*')
      .eq('id', id)
      .single() as any

    if (error || !schedule) {
      return NextResponse.json({ error: 'Zeitplan nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * PATCH /api/schedules/[id]
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

    const validationResult = updateScheduleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const client = await createClient()

    // Get schedule
    const { data: schedule, error: getError } = await client
      .from('schedules')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !schedule) {
      return NextResponse.json({ error: 'Zeitplan nicht gefunden' }, { status: 404 })
    }

    // Check permission
    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', schedule.organization_id)
      .single() as any

    if (!['owner', 'admin', 'manager'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Update
    const { data: updated, error: updateError } = await client
      .from('schedules')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single() as any

    if (updateError) throw updateError
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}

/**
 * DELETE /api/schedules/[id]
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

    // Get schedule
    const { data: schedule, error: getError } = await client
      .from('schedules')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !schedule) {
      return NextResponse.json({ error: 'Zeitplan nicht gefunden' }, { status: 404 })
    }

    // Check permission (admin/owner only)
    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', schedule.organization_id)
      .single() as any

    if (!['owner', 'admin'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    // Delete
    const { error: deleteError } = await client
      .from('schedules')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}