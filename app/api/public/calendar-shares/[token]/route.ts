// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  filterUpcomingAllowedBookings,
  PUBLIC_CALENDAR_SHARE_ERROR,
  serializePublicCalendarBooking,
} from '@/lib/calendar-share'

function publicError() {
  return NextResponse.json({ error: PUBLIC_CALENDAR_SHARE_ERROR }, { status: 404 })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 32) {
    return publicError()
  }

  const supabase = createServiceClient()

  const { data: share, error: shareError } = await supabase
    .from('calendar_share_links')
    .select(`
      id, organization_id, name, allowed_resource_ids, is_active,
      organizations(name, logo_url)
    `)
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (shareError || !share) {
    return publicError()
  }

  const allowedResourceIds = Array.isArray(share.allowed_resource_ids)
    ? share.allowed_resource_ids
    : []

  if (allowedResourceIds.length === 0) {
    return publicError()
  }

  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('id, name')
    .eq('organization_id', share.organization_id)
    .eq('type', 'staff')
    .eq('is_active', true)
    .in('id', allowedResourceIds)
    .order('name')

  if (resourcesError) {
    console.error('Public calendar resources error:', resourcesError)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }

  const visibleResourceIds = (resources || []).map((resource: any) => resource.id)
  if (visibleResourceIds.length === 0) {
    return NextResponse.json({
      share: {
        name: share.name,
        organizationName: share.organizations?.name ?? null,
        organizationLogoUrl: share.organizations?.logo_url ?? null,
      },
      resources: [],
      bookings: [],
    })
  }

  const nowIso = new Date().toISOString()
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      id, customer_name, start_time, end_time, status, resource_id,
      offerings(name),
      resources(name)
    `)
    .eq('organization_id', share.organization_id)
    .gte('start_time', nowIso)
    .in('resource_id', visibleResourceIds)
    .order('start_time', { ascending: true })
    .limit(500)

  if (bookingsError) {
    console.error('Public calendar bookings error:', bookingsError)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }

  try {
    await supabase
      .from('calendar_share_links')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', share.id)
  } catch (error) {
    console.error('Public calendar last access update failed:', error)
  }

  return NextResponse.json({
    share: {
      name: share.name,
      organizationName: share.organizations?.name ?? null,
      organizationLogoUrl: share.organizations?.logo_url ?? null,
    },
    resources: (resources || []).map((resource: any) => ({
      id: resource.id,
      name: resource.name,
    })),
    bookings: filterUpcomingAllowedBookings(
      bookings || [],
      visibleResourceIds,
      nowIso
    ).map(serializePublicCalendarBooking),
  })
}
