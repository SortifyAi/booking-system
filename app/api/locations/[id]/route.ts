// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { UpdateLocationRequest } from '@/types/models'
import { z } from 'zod'

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  timezone: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
})

/**
 * GET /api/locations/[id]
 * Get a specific location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const { id } = await params
    const client = await createClient()

    // Get location (RLS will handle authorization)
    const { data: location, error } = await client
      .from('locations')
      .select('*')
      .eq('id', id)
      .single() as any

    if (error || !location) {
      return NextResponse.json(
        { error: 'Standort nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error('Error fetching location:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/locations/[id]
 * Update a location
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Validate request
    const validationResult = updateLocationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const client = await createClient()

    // Get location to verify ownership
    const { data: location, error: getError } = await client
      .from('locations')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !location) {
      return NextResponse.json(
        { error: 'Standort nicht gefunden' },
        { status: 404 }
      )
    }

    // Check permission
    const { data: membership, error: memberError } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', location.organization_id)
      .single() as any

    if (memberError || !['owner', 'admin', 'manager'].includes(membership?.role || '')) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 403 }
      )
    }

    // Update location
    const { data: updated, error: updateError } = await client
      .from('locations')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single() as any

    if (updateError) throw updateError

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/locations/[id]
 * Delete a location (admin/owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const { id } = await params
    const client = await createClient()

    // Get location
    const { data: location, error: getError } = await client
      .from('locations')
      .select('organization_id')
      .eq('id', id)
      .single() as any

    if (getError || !location) {
      return NextResponse.json(
        { error: 'Standort nicht gefunden' },
        { status: 404 }
      )
    }

    // Check permission (admin or owner only)
    const { data: membership, error: memberError } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', location.organization_id)
      .single() as any

    if (memberError || !['owner', 'admin'].includes(membership?.role || '')) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 403 }
      )
    }

    // Delete location
    const { error: deleteError } = await client
      .from('locations')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting location:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
