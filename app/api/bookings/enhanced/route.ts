// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateManageToken, buildManageUrl } from '@/lib/booking-token'
import { sendBookingConfirmation } from '@/lib/email'
import { resolveClosedReason } from '@/lib/holidays'
import { utcToZonedDateStr } from '@/lib/timezone'

const createEnhancedBookingSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  offeringId: z.string().uuid(),
  resourceId: z.string().uuid().optional(), // Staff member ID
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  privacyNoticeAccepted: z.boolean().optional(),
})

/**
 * GET /api/bookings/enhanced
 * List bookings with staff/resource filtering
 * Query params: location_id, resource_id (staff_id), start_date, end_date, status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('location_id')
    const resourceId = searchParams.get('resource_id') // Staff ID
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const status = searchParams.get('status')

    const client = await createClient()

    // Get user's organizations
    const { data: userOrgs, error: orgError } = await client
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (orgError) throw orgError
    if (!userOrgs?.length) {
      return NextResponse.json({ bookings: [] })
    }

    const orgIds = userOrgs.map(uo => uo.organization_id)

    // Build query
    let query = client
      .from('bookings')
      .select('*, resources(id, name, type)')
      .in('organization_id', orgIds)

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    if (resourceId) {
      query = query.eq('resource_id', resourceId)
    }

    if (startDate) {
      query = query.gte('start_time', startDate)
    }

    if (endDate) {
      query = query.lte('end_time', endDate)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: bookings, error } = await query.order('start_time', {
      ascending: false,
    })

    if (error) throw error

    return NextResponse.json({ 
      bookings: bookings || [],
      filters: {
        locationId,
        resourceId,
        startDate,
        endDate,
        status,
      }
    })
  } catch (error) {
    console.error('Error fetching enhanced bookings:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bookings/enhanced
 * Create a new booking with optional staff/resource assignment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validationResult = createEnhancedBookingSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const {
      organizationId,
      locationId,
      offeringId,
      resourceId, // Staff member ID
      customerName,
      customerEmail,
      customerPhone,
      startTime,
      endTime,
      notes,
      privacyNoticeAccepted,
    } = validationResult.data

    const client = await createClient()
    const user = await getUser()

    if (!user && privacyNoticeAccepted !== true) {
      return NextResponse.json(
        { error: 'Bitte bestätigen Sie die Datenschutzinformationen', code: 'PRIVACY_NOTICE_REQUIRED' },
        { status: 400 }
      )
    }

    // Always load the location: we need its org (for public bookings) plus the
    // settings/timezone to reject bookings on closed days.
    const { data: location, error: locError } = await client
      .from('locations')
      .select('organization_id, settings, timezone')
      .eq('id', locationId)
      .single() as any

    if (locError || !location) {
      return NextResponse.json(
        { error: 'Standort nicht gefunden' },
        { status: 404 }
      )
    }

    const finalOrganizationId = organizationId || location.organization_id

    // Reject public bookings on closed days (public holiday or owner exception).
    // The booking page already hides these slots, but a direct POST must not
    // bypass it. The day is derived in the location's timezone so a late-evening
    // slot is attributed to the correct calendar date. Authenticated staff are
    // exempt so they can still place a booking on a closed day by hand.
    if (!user) {
      const bookingDate = utcToZonedDateStr(startTime, location.timezone || 'Europe/Berlin')
      const closedReason = await resolveClosedReason(location.settings, bookingDate)
      if (closedReason) {
        return NextResponse.json(
          { error: closedReason, code: 'CLOSED' },
          { status: 400 }
        )
      }
    }

    // Verify user has access if authenticated
    if (user) {
      const { data: membership } = await client
        .from('user_organizations')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', finalOrganizationId)
        .single() as any

      // User must be part of organization
      if (!membership) {
        return NextResponse.json(
          { error: 'Nicht autorisiert' },
          { status: 403 }
        )
      }
    }

    let finalResourceId: string | undefined = resourceId

    if (finalResourceId) {
      // Validate explicitly requested staff member
      const { data: resource, error: resError } = await client
        .from('resources')
        .select('id, type, location_id, is_active')
        .eq('id', finalResourceId)
        .eq('type', 'staff')
        .eq('location_id', locationId)
        .eq('is_active', true)
        .single() as any

      if (resError || !resource) {
        return NextResponse.json(
          { error: 'Mitarbeiter nicht gefunden' },
          { status: 404 }
        )
      }
    } else {
      // Auto-assign: pick the staff member with fewest bookings today who is free at the requested time
      const { data: activeStaff, error: staffErr } = await client
        .from('resources')
        .select('id')
        .eq('location_id', locationId)
        .eq('type', 'staff')
        .eq('is_active', true) as any

      if (staffErr) throw staffErr

      if (activeStaff && activeStaff.length > 0) {
        const staffIds: string[] = activeStaff.map((s: any) => s.id)

        const startDay = new Date(startTime)
        startDay.setHours(0, 0, 0, 0)
        const endDay = new Date(startTime)
        endDay.setHours(23, 59, 59, 999)

        // Count all bookings per staff for that day
        const { data: dayBookings } = await client
          .from('bookings')
          .select('resource_id')
          .eq('location_id', locationId)
          .in('status', ['pending', 'confirmed'])
          .gte('start_time', startDay.toISOString())
          .lte('start_time', endDay.toISOString())
          .in('resource_id', staffIds) as any

        const bookingCount = new Map<string, number>()
        staffIds.forEach((id: string) => bookingCount.set(id, 0))
        ;(dayBookings || []).forEach((b: any) => {
          if (b.resource_id) {
            bookingCount.set(b.resource_id, (bookingCount.get(b.resource_id) ?? 0) + 1)
          }
        })

        // Find staff members who already have a conflicting booking in this slot
        const { data: slotConflicts } = await client
          .from('bookings')
          .select('resource_id')
          .eq('location_id', locationId)
          .in('status', ['pending', 'confirmed'])
          .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)
          .in('resource_id', staffIds) as any

        const busyIds = new Set<string>(
          (slotConflicts || []).map((b: any) => b.resource_id).filter(Boolean)
        )

        // Sort free staff by booking count ascending, pick the one with fewest bookings
        const freeStaff = staffIds
          .filter((id: string) => !busyIds.has(id))
          .sort((a: string, b: string) => (bookingCount.get(a) ?? 0) - (bookingCount.get(b) ?? 0))

        if (freeStaff.length === 0) {
          return NextResponse.json(
            { error: 'Dieser Termin ist leider nicht mehr verfügbar.', code: 'SLOT_TAKEN' },
            { status: 409 }
          )
        }

        finalResourceId = freeStaff[0]
      }
    }

    // Check for conflict on the resolved staff member
    let conflictQuery = client
      .from('bookings')
      .select('id')
      .eq('location_id', locationId)
      .in('status', ['pending', 'confirmed'])
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)

    if (finalResourceId) {
      conflictQuery = conflictQuery.eq('resource_id', finalResourceId)
    }

    const { data: conflictingBookings, error: conflictError } = await conflictQuery.limit(1)

    if (conflictError) throw conflictError
    if (conflictingBookings?.length) {
      return NextResponse.json(
        { error: 'Dieser Termin ist leider nicht mehr verfügbar.', code: 'SLOT_TAKEN' },
        { status: 409 }
      )
    }

    // Secret token so the customer can manage/cancel this booking without login
    const manageToken = generateManageToken()

    // Create booking with resource_id
    const { data: booking, error: createError } = await client
      .from('bookings')
      .insert({
        organization_id: finalOrganizationId,
        location_id: locationId,
        offering_id: offeringId,
        resource_id: finalResourceId || null,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
        status: 'confirmed',
        manage_token: manageToken,
        metadata: {
          staffAssigned: !!finalResourceId,
          autoAssigned: !resourceId && !!finalResourceId,
          privacyNoticeAccepted: !user ? true : undefined,
          privacyNoticeAcceptedAt: !user ? new Date().toISOString() : undefined,
        },
      })
      .select('*, resources(id, name, type), offerings(name), locations(name, address), organizations(name)')
      .single() as any

    if (createError) {
      // Race-condition guard: the bookings_no_overlap exclusion constraint
      // rejects this insert if another request booked an overlapping slot for
      // the same resource a moment earlier. Postgres reports this as 23P01.
      // This is the atomic backstop the pre-checks above cannot guarantee.
      if (createError.code === '23P01') {
        return NextResponse.json(
          { error: 'Dieser Termin ist leider nicht mehr verfügbar.', code: 'SLOT_TAKEN' },
          { status: 409 }
        )
      }
      throw createError
    }

    const manageUrl = buildManageUrl(manageToken)

    // Send confirmation email (non-blocking: never fail the booking on email).
    try {
      await sendBookingConfirmation({
        customerName,
        customerEmail,
        offeringName: booking.offerings?.name || 'Service',
        locationName: booking.locations?.name || 'Standort',
        locationAddress: booking.locations?.address || '',
        startTime,
        endTime,
        organizationName: booking.organizations?.name || 'Terminbuchung',
        manageUrl,
        organizationId: finalOrganizationId,
        bookingId: booking.id,
      })
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError)
    }

    return NextResponse.json(
      { ...booking, manageToken, manageUrl },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating enhanced booking:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
