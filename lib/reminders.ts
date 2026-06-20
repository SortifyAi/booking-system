export const DEFAULT_REMINDER_TIMEZONE = 'Europe/Berlin'

export interface ReminderDayWindow {
  timeZone: string
  targetDate: string
  start: Date
  end: Date
  startIso: string
  endIso: string
}

export function getReminderDayWindow(
  now: Date | string = new Date(),
  timeZone?: string | null
): ReminderDayWindow {
  const safeTimeZone = normalizeReminderTimeZone(timeZone)
  const runAt = typeof now === 'string' ? new Date(now) : now
  const targetDate = utcToZonedDateStr(runAt, safeTimeZone)
  const nextDate = addDaysToDateStr(targetDate, 1)
  const start = zonedTimeToUtc(targetDate, 0, 0, safeTimeZone)
  const end = zonedTimeToUtc(nextDate, 0, 0, safeTimeZone)

  return {
    timeZone: safeTimeZone,
    targetDate,
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

export function isInReminderTargetDay(
  bookingStartTime: string,
  now: Date | string = new Date(),
  timeZone?: string | null
): boolean {
  const window = getReminderDayWindow(now, timeZone)
  const start = new Date(bookingStartTime).getTime()

  return start >= window.start.getTime() && start < window.end.getTime()
}

function normalizeReminderTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_REMINDER_TIMEZONE

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return DEFAULT_REMINDER_TIMEZONE
  }
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))

  return date.toISOString().slice(0, 10)
}

function zonedTimeToUtc(
  dateStr: string,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetMs = tzOffsetMs(new Date(utcGuess), timeZone)

  return new Date(utcGuess - offsetMs)
}

function utcToZonedDateStr(iso: string | Date, timeZone: string): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

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
  if (hour === 24) hour = 0
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
