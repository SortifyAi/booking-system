/**
 * "Add to calendar" helpers for booking emails.
 *
 * - Google / Outlook links open a prefilled event in the customer's browser.
 * - The ICS content is served by /api/public/bookings/[token]/ics and covers
 *   Apple Calendar, Outlook desktop and every other ICS-aware client.
 */

export interface CalendarEvent {
  /** Stable unique id for the event (e.g. booking-<id>@bookanord). */
  uid: string
  title: string
  description?: string
  location?: string
  /** ISO 8601 start/end timestamps. */
  start: string
  end: string
}

/** YYYYMMDDTHHMMSSZ in UTC, as required by ICS (RFC 5545) and Google Calendar. */
function toIcsUtc(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Escape a text value for an ICS property per RFC 5545. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Fold a content line to 75 octets per RFC 5545. Picky clients (Apple Calendar)
 * reject over-long lines, which a long location/description can easily produce.
 */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 0) {
    // Continuation lines start with a space, so cap their payload at 74.
    parts.push(rest.slice(0, 74))
    rest = rest.slice(74)
  }
  return parts.join('\r\n ')
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toIcsUtc(event.start)}/${toIcsUtc(event.end)}`,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildOutlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: new Date(event.start).toISOString(),
    enddt: new Date(event.end).toISOString(),
  })
  if (event.description) params.set('body', event.description)
  if (event.location) params.set('location', event.location)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/** Build a complete VCALENDAR document for a single event. */
export function buildIcsContent(event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookaNord//Terminbuchung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n')
}
