import { randomBytes } from 'crypto'

export const CALENDAR_SHARE_TOKEN_BYTES = 32
export const PUBLIC_CALENDAR_SHARE_ERROR = 'Link ungueltig oder deaktiviert'

export interface PublicCalendarBooking {
  id: string
  startTime: string
  endTime: string
  status: string
  resourceId: string | null
  customerName: string
  serviceName: string | null
  staffName: string | null
}

interface RawCalendarBooking {
  id: string
  customer_name?: string | null
  start_time: string
  end_time?: string | null
  status?: string | null
  resource_id?: string | null
  offerings?: { name?: string | null } | null
  resources?: { name?: string | null } | null
}

export function generateCalendarShareToken(): string {
  return randomBytes(CALENDAR_SHARE_TOKEN_BYTES).toString('base64url')
}

export function buildCalendarShareUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return `${base}/kalender/${token}`
}

export function normalizeAllowedResourceIds(
  resourceIds: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>()

  for (const value of resourceIds) {
    const id = value?.trim()
    if (id) seen.add(id)
  }

  return Array.from(seen)
}

export function filterUpcomingAllowedBookings<T extends {
  resource_id?: string | null
  start_time: string
}>(
  bookings: T[],
  allowedResourceIds: string[],
  nowIso = new Date().toISOString()
): T[] {
  const allowed = new Set(allowedResourceIds)
  const now = new Date(nowIso).getTime()

  return bookings.filter((booking) => {
    if (!booking.resource_id || !allowed.has(booking.resource_id)) return false
    return new Date(booking.start_time).getTime() >= now
  })
}

export function serializePublicCalendarBooking(
  booking: RawCalendarBooking
): PublicCalendarBooking {
  return {
    id: booking.id,
    startTime: booking.start_time,
    endTime: booking.end_time || booking.start_time,
    status: booking.status || 'confirmed',
    resourceId: booking.resource_id || null,
    customerName: booking.customer_name || 'Ohne Namen',
    serviceName: booking.offerings?.name ?? null,
    staffName: booking.resources?.name ?? null,
  }
}
