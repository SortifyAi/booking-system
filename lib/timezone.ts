/**
 * Default IANA timezone for the app. Every location stores its own `timezone`,
 * but where one isn't at hand we fall back to this (matches the location form
 * default, the availability slot generation and the reminder window).
 */
export const DEFAULT_TIMEZONE = 'Europe/Berlin'

/**
 * Format the time-of-day (HH:mm) of a UTC instant in a fixed timezone.
 *
 * Booking times are stored as absolute instants (TIMESTAMPTZ). Rendering them
 * with the runtime's timezone shows different clock times on a UTC server (e.g.
 * emails) than in a CEST browser (e.g. the customer's manage page) — that is the
 * source of the "12:00 here, 14:00 there" bug. Pinning to the location timezone
 * makes the displayed wall-clock identical everywhere, regardless of where the
 * code runs.
 */
export function formatTimeInTimeZone(
  iso: string | Date,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('de-DE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Format a full German date of a UTC instant in a fixed timezone. */
export function formatDateInTimeZone(
  iso: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('de-DE', { timeZone, ...options }).format(date)
}

/**
 * Convert a wall-clock time in a given IANA timezone to the absolute instant
 * (UTC) it represents.
 *
 * Opening hours are configured as wall-clock times ("09:00") in the location's
 * timezone, but the server may run in any timezone — UTC on most hosts. Building
 * the slot with `setHours(date, 9)` interprets "09:00" in the SERVER's timezone,
 * so on a UTC host 09:00 is emitted as 09:00Z and then rendered as 11:00 in a
 * CEST browser (UTC+2). This computes the real UTC instant for the wall-clock
 * time in `timeZone`, independent of where the server runs.
 */
export function zonedTimeToUtc(
  dateStr: string, // 'YYYY-MM-DD'
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  // First guess: treat the wall-clock components as if they were already UTC.
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  // Correct by the timezone's offset at that instant (handles DST).
  const offsetMs = tzOffsetMs(new Date(utcGuess), timeZone)
  return new Date(utcGuess - offsetMs)
}

/**
 * Calendar date ('YYYY-MM-DD') that a UTC instant falls on in `timeZone`.
 *
 * Used to decide which day a booking belongs to for the closed-day / holiday
 * check: a 23:30 UTC slot is already the next day in Europe/Berlin, so the date
 * must be derived in the location's timezone, not the server's.
 */
export function utcToZonedDateStr(iso: string | Date, timeZone: string): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  // 'en-CA' formats as YYYY-MM-DD, which is exactly the shape we want.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Offset (ms) of `timeZone` from UTC at the given instant: zoned − utc. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value
  let hour = Number(map.hour)
  if (hour === 24) hour = 0 // some engines emit '24' for midnight
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  )
  return asUtc - date.getTime()
}
