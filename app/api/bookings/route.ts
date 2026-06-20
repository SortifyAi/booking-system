// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { CreateBookingRequest, Booking } from '@/types/models'
import { z } from 'zod'
import { sendBookingConfirmation } from '@/lib/email'
import { normalizeEmail } from '@/lib/email-domain'
import { publicBookingEmailError } from '@/lib/customer-email'
import { guardPublicBookingEmail } from '@/lib/public-booking-email-guard'

const createBookingSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  offeringId: z.string().uuid(),
  resourceId: z.string().uuid().optional(), // Optional: auto-assign if not provided
  customerName: z.string().min(1),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  privacyNoticeAccepted: z.boolean().optional(),
})

/**
 * GET /api/bookings
 * List bookings for authenticated user's organizations
 * Query params: location_id, start_date, end_date, status
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
      .select('*')
      .in('organization_id', orgIds)

    if (locationId) {
      query = query.eq('location_id', locationId)
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

    return NextResponse.json({ bookings: bookings || [] })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bookings
 * Create a new booking
 * Can be called by authenticated users or public (with rate limiting)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validationResult = createBookingSchema.safeParse(body)
    if (!validationResult.success) {
      if (validationResult.error.issues.some((issue) => issue.path[0] === 'customerEmail')) {
        return NextResponse.json(publicBookingEmailError('invalid'), { status: 400 })
      }
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const {
      organizationId,
      locationId,
      offeringId,
      resourceId: selectedResourceId,
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

    const { data: bookingLocation, error: locationError } = await client
      .from('locations')
      .select('organization_id, name, address, phone')
      .eq('id', locationId)
      .single() as any

    if (locationError || !bookingLocation) {
      return NextResponse.json(
        { error: 'Standort nicht gefunden' },
        { status: 404 }
      )
    }

    const finalOrganizationId = user && organizationId
      ? organizationId
      : bookingLocation.organization_id
    const normalizedCustomerEmail = normalizeEmail(customerEmail)

    if (!user) {
      const emailGuard = await guardPublicBookingEmail({
        email: normalizedCustomerEmail,
        organizationId: finalOrganizationId,
        locationPhone: bookingLocation.phone,
      })
      if (!emailGuard.ok) {
        return NextResponse.json(emailGuard.body, { status: emailGuard.status })
      }
    }

    // Auto-assign staff if not selected: find staff with fewest bookings at this time
    let finalResourceId = selectedResourceId
    if (!finalResourceId) {
      // Get all staff resources for this location
      const { data: staffMembers, error: staffError } = await client
        .from('resources')
        .select('id, name, type')
        .eq('location_id', locationId)
        .eq('type', 'staff')
        .eq('is_active', true)

      if (!staffError && staffMembers?.length) {
        // Count bookings for each staff member at the requested time
        let minBookings = Infinity
        let bestStaff = null

        for (const staff of staffMembers) {
          const { data: bookings } = await client
            .from('bookings')
            .select('id')
            .eq('resource_id', staff.id)
            .in('status', ['pending', 'confirmed'])
            .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)

          const bookingCount = bookings?.length || 0
          if (bookingCount < minBookings) {
            minBookings = bookingCount
            bestStaff = staff.id
          }
        }

        finalResourceId = bestStaff
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

    // Check availability (considering staff/resource if assigned)
    let conflictingBookings
    if (finalResourceId) {
      // Check specifically for the selected/assigned staff
      const { data: conflict, error: conflictError } = await client
        .from('bookings')
        .select('id')
        .eq('resource_id', finalResourceId)
        .in('status', ['pending', 'confirmed'])
        .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)
        .limit(1)
      conflictingBookings = conflict
      if (conflictError) throw conflictError
    } else {
      // No specific staff - just check location-level conflicts
      const { data: conflict, error: conflictError } = await client
        .from('bookings')
        .select('id')
        .eq('location_id', locationId)
        .eq('offering_id', offeringId)
        .in('status', ['pending', 'confirmed'])
        .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)
        .limit(1)
      conflictingBookings = conflict
      if (conflictError) throw conflictError
    }

    if (conflictingBookings?.length) {
      return NextResponse.json(
        { error: 'Time slot not available' },
        { status: 409 }
      )
    }

    // Create booking
    const { data: booking, error: createError } = await client
      .from('bookings')
      .insert({
        organization_id: finalOrganizationId,
        location_id: locationId,
        offering_id: offeringId,
        resource_id: finalResourceId || null,
        customer_name: customerName,
        customer_email: normalizedCustomerEmail,
        customer_phone: customerPhone || null,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
        status: 'pending',
        metadata: {
          privacyNoticeAccepted: !user ? true : undefined,
          privacyNoticeAcceptedAt: !user ? new Date().toISOString() : undefined,
        },
      })
      .select()
      .single() as any

    if (createError) throw createError

    const { data: offering } = await client
      .from('offerings')
      .select('name')
      .eq('id', offeringId)
      .single() as any

    const { data: organization } = await client
      .from('organizations')
      .select('name')
      .eq('id', finalOrganizationId)
      .single() as any

    const delivery = await sendBookingConfirmation({
      customerName,
      customerEmail: normalizedCustomerEmail,
      offeringName: offering?.name || 'Service',
      locationName: bookingLocation.name || 'Standort',
      locationAddress: bookingLocation.address || '',
      timeZone: bookingLocation.timezone,
      startTime,
      endTime,
      organizationName: organization?.name || 'Terminbuchung',
      organizationId: finalOrganizationId,
      bookingId: booking.id,
    })

    if (!delivery.success) {
      return NextResponse.json(
        publicBookingEmailError('contact', bookingLocation.phone),
        { status: 503 }
      )
    }

    const { error: confirmError } = await client
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking.id)

    if (confirmError) {
      console.error('Failed to confirm booking after email delivery:', confirmError)
      return NextResponse.json(
        publicBookingEmailError('contact', bookingLocation.phone),
        { status: 503 }
      )
    }

    return NextResponse.json({ ...booking, status: 'confirmed' }, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}
