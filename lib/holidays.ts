/**
 * German public holidays and per-location schedule exceptions.
 *
 * Holidays are fetched per Bundesland from the free, key-less feiertage-api.de
 * (https://feiertage-api.de/api/?jahr=YYYY&nur_land=XX). On a holiday the
 * location counts as closed unless the owner has added an exception for that
 * date. Exceptions live in `location.settings.exceptions`; the Bundesland in
 * `location.settings.bundesland` — both managed from the location form, so no
 * DB migration is needed. See [[lib/timezone.ts]] for the wall-clock → UTC
 * conversion used when turning opening hours into bookable slots.
 */

/** A single-day override the location owner configured. */
export type ScheduleException = {
  date: string // 'YYYY-MM-DD'
  closed: boolean // true = closed; false = custom open/close hours
  open?: string // 'HH:mm' (when !closed)
  close?: string // 'HH:mm' (when !closed)
  note?: string // optional reason, shown to customers when closed
}

type SettingsLike =
  | { bundesland?: unknown; exceptions?: unknown }
  | null
  | undefined

/** The 16 German states with the codes feiertage-api.de expects in `nur_land`. */
export const GERMAN_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
]

const VALID_STATE_CODES = new Set(GERMAN_STATES.map((s) => s.code))

/** Read the configured Bundesland code from a location's settings JSON. */
export function getBundesland(settings: SettingsLike): string {
  const value = (settings as { bundesland?: unknown } | null)?.bundesland
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return VALID_STATE_CODES.has(code) ? code : ''
}

/** Read the owner-configured exceptions from a location's settings JSON. */
export function getExceptions(settings: SettingsLike): ScheduleException[] {
  const value = (settings as { exceptions?: unknown } | null)?.exceptions
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is ScheduleException =>
      !!e && typeof e === 'object' && typeof (e as ScheduleException).date === 'string'
  )
}

/** The exception for a specific date, if the owner configured one. */
export function findException(
  settings: SettingsLike,
  dateStr: string
): ScheduleException | undefined {
  return getExceptions(settings).find((e) => e.date === dateStr)
}

/**
 * Custom opening window for a date, if an exception sets one (not closed and
 * both times present). Overrides the regular schedules/opening hours that day.
 */
export function getExceptionWindow(
  settings: SettingsLike,
  dateStr: string
): { open: string; close: string } | null {
  const ex = findException(settings, dateStr)
  if (ex && !ex.closed && ex.open && ex.close) {
    return { open: ex.open, close: ex.close }
  }
  return null
}

// Successful API responses are cached for the lifetime of the server instance,
// keyed by `${land}-${year}`. Holidays for a year never change, and failures are
// not cached so a transient API outage is retried on the next request.
const holidayCache = new Map<string, Map<string, string>>()

const FEIERTAGE_API = 'https://feiertage-api.de/api/'
const FETCH_TIMEOUT_MS = 3000

/**
 * Map of `YYYY-MM-DD` → holiday name for a Bundesland and year. Returns an empty
 * map (never throws) if the code is unknown or the API is unreachable, so a
 * holiday lookup can never block a booking.
 */
export async function fetchHolidays(
  land: string,
  year: number
): Promise<Map<string, string>> {
  const code = land?.trim().toUpperCase() ?? ''
  if (!VALID_STATE_CODES.has(code) || !Number.isInteger(year)) return new Map()

  const cacheKey = `${code}-${year}`
  const cached = holidayCache.get(cacheKey)
  if (cached) return cached

  const result = new Map<string, string>()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(
      `${FEIERTAGE_API}?jahr=${year}&nur_land=${code}`,
      { signal: controller.signal }
    )
    if (res.ok) {
      const data = (await res.json()) as Record<string, { datum?: unknown }>
      for (const [name, value] of Object.entries(data)) {
        if (value && typeof value.datum === 'string') result.set(value.datum, name)
      }
      holidayCache.set(cacheKey, result)
    } else {
      console.error(`Feiertage API returned ${res.status} for ${cacheKey}`)
    }
  } catch (err) {
    console.error('Failed to fetch holidays:', err)
  } finally {
    clearTimeout(timeout)
  }
  return result
}

/** Holiday name for a date in the given Bundesland, or null if it isn't one. */
export async function getHolidayName(
  land: string,
  dateStr: string
): Promise<string | null> {
  const year = Number(dateStr.slice(0, 4))
  if (!Number.isInteger(year)) return null
  const holidays = await fetchHolidays(land, year)
  return holidays.get(dateStr) ?? null
}

/**
 * Why the location is closed on `dateStr`, or null if it's open that day.
 *
 * Precedence: a configured exception fully overrides the holiday calendar — a
 * `closed` exception closes the day (with its note, or "Geschlossen"), while an
 * exception with custom hours keeps it open even on a public holiday. Only when
 * no exception exists does a Bundesland holiday close the day.
 */
export async function resolveClosedReason(
  settings: SettingsLike,
  dateStr: string
): Promise<string | null> {
  const ex = findException(settings, dateStr)
  if (ex) {
    if (ex.closed) {
      const note = typeof ex.note === 'string' ? ex.note.trim() : ''
      return note || 'Geschlossen'
    }
    return null // custom-hours exception → open
  }

  const land = getBundesland(settings)
  if (!land) return null
  const name = await getHolidayName(land, dateStr)
  return name ? `Feiertag: ${name}` : null
}
