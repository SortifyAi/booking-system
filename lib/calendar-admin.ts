export interface CalendarStaffMember {
  id: string
  name: string
  color: string
}

export interface CalendarBooking {
  id: string
  start_time: string
  end_time: string
  guest_name: string
  service: string
  status: string
  location_id: string
  organization_id?: string | null
  group_id?: string | null
  offering_id?: string | null
  resource_id?: string | null
  staff_id?: string | null
  staff_name?: string
  staff_color?: string
  customer_phone?: string | null
  customer_email?: string | null
  notes?: string | null
}

export interface CalendarBlock {
  id: string
  start_time: string
  end_time: string
  location_id?: string | null
  resource_id?: string | null
  staff_id?: string | null
  staff_name?: string
  staff_color?: string
  reason?: string | null
  type: string
}

export const blockTypeLabels: Record<string, string> = {
  vacation: 'Urlaub',
  sick: 'Krankheit',
  break: 'Pause',
  maintenance: 'Wartung',
  other: 'Blocker',
}

const humanizeLegacyStaffId = (staffId?: string | null) => {
  if (!staffId) return ''

  const value = staffId.startsWith('staff-') ? staffId.replace('staff-', '') : staffId
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getBookingStaffId(booking: {
  resource_id?: string | null
  staff_id?: string | null
}) {
  return booking.resource_id || booking.staff_id || ''
}

export function getStaffLabel(booking: {
  staff_name?: string | null
  resource_id?: string | null
  staff_id?: string | null
}) {
  return booking.staff_name || humanizeLegacyStaffId(getBookingStaffId(booking))
}

export function getBookingDisplayParts(booking: {
  guest_name?: string | null
  customer_name?: string | null
  staff_name?: string | null
  resource_id?: string | null
  staff_id?: string | null
}) {
  return {
    title: booking.guest_name || booking.customer_name || 'Ohne Namen',
    staffLabel: getStaffLabel(booking),
  }
}

export function normalizeCalendarBooking(
  booking: any,
  staffMembers: CalendarStaffMember[] = []
): CalendarBooking {
  const staffId = getBookingStaffId(booking)
  const staff = staffMembers.find((member) => member.id === staffId)
  const offeringName =
    booking.service ||
    booking.offering_name ||
    booking.offerings?.name ||
    booking.offering?.name ||
    'Termin'

  return {
    id: booking.id,
    start_time: booking.start_time,
    end_time: booking.end_time,
    guest_name: booking.guest_name || booking.customer_name || 'Ohne Namen',
    service: offeringName,
    status: booking.status || 'pending',
    location_id: booking.location_id,
    organization_id: booking.organization_id ?? null,
    group_id: booking.group_id ?? null,
    offering_id: booking.offering_id || null,
    resource_id: booking.resource_id || null,
    staff_id: staffId || null,
    staff_name: staff?.name || booking.resources?.name || getStaffLabel({ ...booking, staff_id: staffId }),
    staff_color: staff?.color,
    customer_phone: booking.customer_phone ?? null,
    customer_email: booking.customer_email ?? null,
    notes: booking.notes ?? null,
  }
}

export function normalizeCalendarBlock(
  block: any,
  staffMembers: CalendarStaffMember[] = []
): CalendarBlock {
  const staffId = block.resource_id || block.staff_id || null
  const staff = staffMembers.find((member) => member.id === staffId)

  return {
    id: block.id,
    start_time: block.start_time,
    end_time: block.end_time,
    location_id: block.location_id ?? null,
    resource_id: staffId,
    staff_id: staffId,
    staff_name: staff?.name,
    staff_color: staff?.color,
    reason: block.reason ?? null,
    type: block.type || 'other',
  }
}
