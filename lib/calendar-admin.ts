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
  offering_id?: string | null
  resource_id?: string | null
  staff_id?: string | null
  staff_name?: string
  staff_color?: string
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
    offering_id: booking.offering_id || null,
    resource_id: booking.resource_id || null,
    staff_id: staffId || null,
    staff_name: staff?.name || booking.resources?.name || getStaffLabel({ ...booking, staff_id: staffId }),
    staff_color: staff?.color,
  }
}
