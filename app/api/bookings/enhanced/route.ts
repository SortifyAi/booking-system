// @ts-nocheck
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateManageToken, buildManageUrl } from '@/lib/booking-token'
import { BOOKING_IN_PAST_ERROR, isFutureBookingStart } from '@/lib/booking-policy'
import { sendBookingConfirmation } from '@/lib/email'
import { resolveClosedReason } from '@/lib/holidays'
import { utcToZonedDateStr } from '@/lib/timezone'
import { blockBlocksSlot } from '@/lib/block-availability'
import { normalizeEmail } from '@/lib/email-domain'
import { publicBookingEmailError } from '@/lib/customer-email'
import { guardPublicBookingEmail } from '@/lib/public-booking-email-guard'

const createEnhancedBookingSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  offeringId: z.string().uuid(),
  resourceId: z.string().uuid().optional(), // Staff member ID
  addonIds: z.array(z.string().uuid()).optional(), // Zusatzleistungen (Offerings)
  customerName: z.string().min(1),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  privacyNoticeAccepted: z.boolean().optional(),
})

// Sammelbuchung mehrerer Personen: jede Position startet zur selben Zeit und
// bekommt einen eigenen, automatisch zugewiesenen Mitarbeiter.
const createGroupBookingSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  items: z
    .array(
      z.object({
        offeringId: z.string().uuid(),
        addonIds: z.array(z.string().uuid()).optional(),
      })
    )
    .min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().optional(),
  startTime: z.string().datetime(),
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

    // Sammelbuchung (mehrere Personen) hat einen eigenen Pfad.
    if (Array.isArray(body.items) && body.items.length > 0) {
      return await createGroupBooking(body)
    }

    // Validate request
    const validationResult = createEnhancedBookingSchema.safeParse(body)
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
      resourceId, // Staff member ID
      addonIds,
      customerName,
      customerEmail,
      customerPhone,
      startTime,
      endTime,
      notes,
      privacyNoticeAccepted,
    } = validationResult.data

    if (!isFutureBookingStart(startTime)) {
      return NextResponse.json(
        { error: BOOKING_IN_PAST_ERROR, code: 'BOOKING_IN_PAST' },
        { status: 400 }
      )
    }

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
      .select('organization_id, settings, timezone, phone')
      .eq('id', locationId)
      .single() as any

    if (locError || !location) {
      return NextResponse.json(
        { error: 'Standort nicht gefunden' },
        { status: 404 }
      )
    }

    const finalOrganizationId = user && organizationId
      ? organizationId
      : location.organization_id
    const normalizedCustomerEmail = normalizeEmail(customerEmail)

    if (!user) {
      const emailGuard = await guardPublicBookingEmail({
        email: normalizedCustomerEmail,
        organizationId: finalOrganizationId,
        locationPhone: location.phone,
      })
      if (!emailGuard.ok) {
        return NextResponse.json(emailGuard.body, { status: emailGuard.status })
      }
    }

    // Zusatzleistungen der Einzelbuchung: validieren, Gesamtdauer/Ende
    // serverseitig ableiten (gegen Manipulation) und für die Buchung merken.
    let effectiveEndTime = endTime
    let addonsMeta: { id: string; name: string; priceCents: number | null; durationMinutes: number }[] = []
    if (addonIds && addonIds.length > 0) {
      const uniqueAddonIds = Array.from(new Set(addonIds))
      const { data: addonRows } = await client
        .from('offerings')
        .select('id, name, price_cents, duration_minutes, available_as_addon, location_id, is_active')
        .in('id', uniqueAddonIds) as any

      const validAddons = (addonRows || []).filter(
        (r: any) => r.location_id === locationId && r.is_active && r.available_as_addon
      )
      if (validAddons.length !== uniqueAddonIds.length) {
        return NextResponse.json(
          { error: 'Ungültige Zusatzleistung', code: 'INVALID_ADDON' },
          { status: 400 }
        )
      }

      const { data: mainOffering } = await client
        .from('offerings')
        .select('duration_minutes')
        .eq('id', offeringId)
        .single() as any

      const mainDuration = mainOffering?.duration_minutes || 0
      const addonDuration = validAddons.reduce((sum: number, r: any) => sum + (r.duration_minutes || 0), 0)
      effectiveEndTime = new Date(new Date(startTime).getTime() + (mainDuration + addonDuration) * 60000).toISOString()
      addonsMeta = validAddons.map((r: any) => ({
        id: r.id,
        name: r.name,
        priceCents: r.price_cents ?? null,
        durationMinutes: r.duration_minutes,
      }))
    }

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
          .or(`and(start_time.lt.${effectiveEndTime},end_time.gt.${startTime})`)
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
      .or(`and(start_time.lt.${effectiveEndTime},end_time.gt.${startTime})`)

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
        customer_email: normalizedCustomerEmail,
        customer_phone: customerPhone || null,
        start_time: startTime,
        end_time: effectiveEndTime,
        notes: notes || null,
        status: 'pending',
        manage_token: manageToken,
        metadata: {
          staffAssigned: !!finalResourceId,
          autoAssigned: !resourceId && !!finalResourceId,
          addons: addonsMeta,
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

    const delivery = await sendBookingConfirmation({
      customerName,
      customerEmail: normalizedCustomerEmail,
      offeringName: booking.offerings?.name || 'Service',
      addonNames: addonsMeta.map((a) => a.name),
      locationName: booking.locations?.name || 'Standort',
      locationAddress: booking.locations?.address || '',
      timeZone: booking.locations?.timezone,
      startTime,
      endTime: effectiveEndTime,
      organizationName: booking.organizations?.name || 'Terminbuchung',
      manageUrl,
      manageToken,
      organizationId: finalOrganizationId,
      bookingId: booking.id,
    })

    if (!delivery.success) {
      return NextResponse.json(
        publicBookingEmailError('contact', location.phone),
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
        publicBookingEmailError('contact', location.phone),
        { status: 503 }
      )
    }

    return NextResponse.json(
      { ...booking, status: 'confirmed', manageToken, manageUrl },
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

/**
 * Sammelbuchung mehrerer Personen, die PARALLEL zur selben Startzeit beginnen.
 * Jede Position erhält automatisch einen eigenen freien Mitarbeiter; alle
 * erzeugten Buchungen teilen sich group_id und manage_token, sodass Verwaltung
 * und Storno die ganze Gruppe betreffen.
 */
async function createGroupBooking(body: unknown) {
  const validationResult = createGroupBookingSchema.safeParse(body)
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
    items,
    customerName,
    customerEmail,
    customerPhone,
    startTime,
    notes,
    privacyNoticeAccepted,
  } = validationResult.data

  if (!isFutureBookingStart(startTime)) {
    return NextResponse.json(
      { error: BOOKING_IN_PAST_ERROR, code: 'BOOKING_IN_PAST' },
      { status: 400 }
    )
  }

  const client = await createClient()
  const user = await getUser()

  if (!user && privacyNoticeAccepted !== true) {
    return NextResponse.json(
      { error: 'Bitte bestätigen Sie die Datenschutzinformationen', code: 'PRIVACY_NOTICE_REQUIRED' },
      { status: 400 }
    )
  }

  const { data: location, error: locError } = await client
    .from('locations')
    .select('organization_id, settings, timezone, name, address, phone')
    .eq('id', locationId)
    .single() as any

  if (locError || !location) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  }

  const finalOrganizationId = user && organizationId
    ? organizationId
    : location.organization_id
  const normalizedCustomerEmail = normalizeEmail(customerEmail)

  if (!user) {
    const emailGuard = await guardPublicBookingEmail({
      email: normalizedCustomerEmail,
      organizationId: finalOrganizationId,
      locationPhone: location.phone,
    })
    if (!emailGuard.ok) {
      return NextResponse.json(emailGuard.body, { status: emailGuard.status })
    }
  }

  if (!user) {
    const bookingDate = utcToZonedDateStr(startTime, location.timezone || 'Europe/Berlin')
    const closedReason = await resolveClosedReason(location.settings, bookingDate)
    if (closedReason) {
      return NextResponse.json({ error: closedReason, code: 'CLOSED' }, { status: 400 })
    }
  }

  if (user) {
    const { data: membership } = await client
      .from('user_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', finalOrganizationId)
      .single() as any
    if (!membership) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }
  }

  // Alle referenzierten Offerings (Hauptservices + Zusatzleistungen) laden.
  const allOfferingIds = Array.from(
    new Set(items.flatMap((it) => [it.offeringId, ...(it.addonIds || [])]))
  )
  const { data: offeringRows, error: offErr } = await client
    .from('offerings')
    .select('id, name, price_cents, duration_minutes, available_as_addon, location_id, is_active')
    .in('id', allOfferingIds) as any

  if (offErr) throw offErr
  const offeringById = new Map((offeringRows || []).map((o: any) => [o.id, o]))

  // Positionen aufbereiten: Dauer/Ende + Zusatzleistungs-Metadaten (serverseitig).
  const preparedItems: any[] = []
  for (const it of items) {
    const main: any = offeringById.get(it.offeringId)
    if (!main || main.location_id !== locationId || !main.is_active) {
      return NextResponse.json({ error: 'Ungültige Leistung', code: 'INVALID_OFFERING' }, { status: 400 })
    }
    const addonIds = Array.from(new Set(it.addonIds || []))
    const addons: any[] = []
    for (const aid of addonIds) {
      const a: any = offeringById.get(aid)
      if (!a || a.location_id !== locationId || !a.is_active || !a.available_as_addon) {
        return NextResponse.json({ error: 'Ungültige Zusatzleistung', code: 'INVALID_ADDON' }, { status: 400 })
      }
      addons.push({ id: a.id, name: a.name, priceCents: a.price_cents ?? null, durationMinutes: a.duration_minutes })
    }
    const duration = (main.duration_minutes || 0) + addons.reduce((s, a) => s + (a.durationMinutes || 0), 0)
    preparedItems.push({
      offeringId: main.id,
      offeringName: main.name,
      duration,
      endTime: new Date(new Date(startTime).getTime() + duration * 60000).toISOString(),
      addons,
    })
  }

  // Aktive Mitarbeiter laden.
  const { data: activeStaff, error: staffErr } = await client
    .from('resources')
    .select('id, name')
    .eq('location_id', locationId)
    .eq('type', 'staff')
    .eq('is_active', true) as any

  if (staffErr) throw staffErr
  const staff = activeStaff || []
  if (staff.length < preparedItems.length) {
    return NextResponse.json(
      { error: 'Nicht genügend Mitarbeiter für diese Buchung verfügbar.', code: 'SLOT_TAKEN' },
      { status: 409 }
    )
  }

  const staffIds: string[] = staff.map((s: any) => s.id)
  const startDay = new Date(startTime); startDay.setHours(0, 0, 0, 0)
  const endDay = new Date(startTime); endDay.setHours(23, 59, 59, 999)

  const { data: dayBookings } = await client
    .from('bookings')
    .select('start_time, end_time, resource_id')
    .eq('location_id', locationId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', startDay.toISOString())
    .lte('start_time', endDay.toISOString())
    .in('resource_id', staffIds) as any

  // Overlap, nicht Containment: ein mehrtägiger Block (z. B. Urlaub) startet vor
  // und endet nach dem Buchungstag und muss trotzdem gefunden werden.
  const { data: blocks } = await client
    .from('blocks')
    .select('start_time, end_time, resource_id')
    .lte('start_time', endDay.toISOString())
    .gte('end_time', startDay.toISOString()) as any

  const slotStart = new Date(startTime)
  const isFree = (staffId: string, itemEndIso: string) => {
    const itemEnd = new Date(itemEndIso)
    for (const b of dayBookings || []) {
      if (b.resource_id !== staffId) continue
      if (slotStart < new Date(b.end_time) && itemEnd > new Date(b.start_time)) return false
    }
    for (const bl of blocks || []) {
      if (blockBlocksSlot(bl, slotStart, itemEnd, staffId)) return false
    }
    return true
  }

  // Tagesauslastung je Mitarbeiter (Load-Balancing).
  const loadByStaff = new Map<string, number>(staffIds.map((id) => [id, 0]))
  ;(dayBookings || []).forEach((b: any) => {
    if (b.resource_id != null && loadByStaff.has(b.resource_id)) {
      loadByStaff.set(b.resource_id, (loadByStaff.get(b.resource_id) || 0) + 1)
    }
  })

  // Längste Positionen zuerst; je Position freien, noch nicht benutzten
  // Mitarbeiter mit geringster Auslastung wählen.
  const order = preparedItems
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => b.item.duration - a.item.duration)

  const used = new Set<string>()
  const assignment: (string | null)[] = new Array(preparedItems.length).fill(null)
  for (const { item, idx } of order) {
    const candidate = staffIds
      .filter((id) => !used.has(id) && isFree(id, item.endTime))
      .sort((a, b) => (loadByStaff.get(a) || 0) - (loadByStaff.get(b) || 0))[0]
    if (!candidate) {
      return NextResponse.json(
        { error: 'Dieser Termin ist leider nicht mehr verfügbar.', code: 'SLOT_TAKEN' },
        { status: 409 }
      )
    }
    used.add(candidate)
    assignment[idx] = candidate
  }

  const groupId = randomUUID()
  // manage_token ist unique pro Zeile (Unique-Index idx_bookings_manage_token).
  // Die Gruppe wird über group_id verknüpft; der Kundenlink nutzt das Token der
  // ersten Position und lädt die Geschwister über group_id nach.
  const primaryToken = generateManageToken()
  const staffNameById = new Map<string, string>(staff.map((s: any) => [s.id, s.name]))

  const rows = preparedItems.map((item, idx) => ({
    organization_id: finalOrganizationId,
    location_id: locationId,
    offering_id: item.offeringId,
    resource_id: assignment[idx],
    customer_name: customerName,
    customer_email: normalizedCustomerEmail,
    customer_phone: customerPhone || null,
    start_time: startTime,
    end_time: item.endTime,
    notes: notes || null,
    status: 'pending',
    manage_token: idx === 0 ? primaryToken : generateManageToken(),
    group_id: groupId,
    metadata: {
      staffAssigned: true,
      autoAssigned: true,
      groupId,
      addons: item.addons,
      privacyNoticeAccepted: !user ? true : undefined,
      privacyNoticeAcceptedAt: !user ? new Date().toISOString() : undefined,
    },
  }))

  const { data: inserted, error: createError } = await client
    .from('bookings')
    .insert(rows)
    .select('id, offering_id, resource_id, end_time') as any

  if (createError) {
    // Atomarer Schutz: die Exclusion-Constraint bricht das gesamte INSERT ab,
    // wenn ein Slot zwischenzeitlich belegt wurde (23P01) – keine Teilzeilen.
    if (createError.code === '23P01') {
      return NextResponse.json(
        { error: 'Dieser Termin ist leider nicht mehr verfügbar.', code: 'SLOT_TAKEN' },
        { status: 409 }
      )
    }
    throw createError
  }

  const manageUrl = buildManageUrl(primaryToken)

  const { data: orgRow } = await client
    .from('organizations')
    .select('name')
    .eq('id', finalOrganizationId)
    .single() as any

  const maxEnd = preparedItems.reduce(
    (acc: string, it: any) => (new Date(it.endTime) > new Date(acc) ? it.endTime : acc),
    preparedItems[0].endTime
  )

  const delivery = await sendBookingConfirmation({
    customerName,
    customerEmail: normalizedCustomerEmail,
    offeringName: preparedItems[0].offeringName,
    items: preparedItems.map((it, idx) => ({
      serviceName: it.offeringName,
      staffName: staffNameById.get(assignment[idx] as string) || null,
      addons: it.addons.map((a: any) => a.name),
    })),
    locationName: location.name || 'Standort',
    locationAddress: location.address || '',
    timeZone: location.timezone,
    startTime,
    endTime: maxEnd,
    organizationName: orgRow?.name || 'Terminbuchung',
    manageUrl,
    manageToken: primaryToken,
    organizationId: finalOrganizationId,
    bookingId: inserted?.[0]?.id,
  })

  if (!delivery.success) {
    return NextResponse.json(
      publicBookingEmailError('contact', location.phone),
      { status: 503 }
    )
  }

  const insertedIds = (inserted || []).map((row: { id: string }) => row.id)
  const { error: confirmError } = await client
    .from('bookings')
    .update({ status: 'confirmed' })
    .in('id', insertedIds)

  if (confirmError) {
    console.error('Failed to confirm booking group after email delivery:', confirmError)
    return NextResponse.json(
      publicBookingEmailError('contact', location.phone),
      { status: 503 }
    )
  }

  return NextResponse.json(
    {
      groupId,
      manageToken: primaryToken,
      manageUrl,
      bookings: (inserted || []).map((row: any) => ({ ...row, status: 'confirmed' })),
    },
    { status: 201 }
  )
}
