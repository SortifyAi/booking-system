// @ts-nocheck
/**
 * GET /api/availability/range
 *
 * Tages-Verfügbarkeit über einen Zeitraum – die Datengrundlage für die
 * Monatsansicht und die "nächster freier Termin"-Anzeige der öffentlichen
 * Buchungsseite. Statt pro Tag einen eigenen Request abzusetzen (langsam,
 * dutzende Calls beim Öffnen des Kalenders), liefert dieser Endpunkt für jeden
 * Tag eines Zeitraums ein einfaches `available`-Flag und sucht zusätzlich den
 * nächsten freien Tag bis zu 92 Tage voraus.
 *
 * Die Slot-Logik spiegelt bewusst die Einzeltags-Endpunkte:
 * - Einzelperson  → wie /availability/enhanced (Buchungen je Offering gefiltert,
 *   optional auf einen Wunsch-Mitarbeiter eingeschränkt)
 * - Mehrere Pers. → wie /availability/cart (Hall-Bedingung über alle Buchungen)
 * So ist ein als "frei" markierter Tag garantiert auch in der Slot-Liste frei.
 *
 * Query params:
 * - locationId: required (uuid)
 * - from: required (YYYY-MM-DD) – erster Tag des Zeitraums
 * - to: required (YYYY-MM-DD) – letzter Tag des Zeitraums (max. 62 Tage)
 * - offeringId: für Einzelperson (uuid)
 * - duration: kombinierte Dauer in Minuten für Einzelperson (Leistung + Zusätze)
 * - durations: kommagetrennte Minuten je Person für Sammelbuchung, z.B. "45,90"
 * - preferredStaffId: optional (uuid) – nur Verfügbarkeit dieses Mitarbeiters
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/server/db'
import { z } from 'zod'
import { parse, addMinutes, addDays, format, differenceInCalendarDays } from 'date-fns'
import { BUSINESS_HOURS } from '@/lib/constants'
import { zonedTimeToUtc } from '@/lib/timezone'
import { resolveClosedReason, getExceptionWindow } from '@/lib/holidays'
import { isFutureBookingStart } from '@/lib/booking-policy'
import { blockBlocksSlot } from '@/lib/block-availability'
import { demoLocations, isDemoLocationId } from '@/lib/public-demo'

// Tage, die der Kalender pro Anfrage rendert (ein Monat + etwas Puffer).
const MAX_RANGE_DAYS = 62
// Wie weit "nächster freier Termin" maximal vorausschaut, wenn im sichtbaren
// Zeitraum nichts frei ist (z. B. Mitarbeiter mehrere Wochen im Urlaub).
const NEXT_AVAILABLE_HORIZON_DAYS = 92

const rangeSchema = z.object({
  locationId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offeringId: z.string().uuid().optional(),
  preferredStaffId: z.string().uuid().optional(),
  duration: z.number().int().positive().optional(),
  durations: z.array(z.number().int().positive()).optional(),
})

interface DayAvailability {
  date: string
  available: boolean
  closed: boolean
  closedReason?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const durationsRaw = (searchParams.get('durations') || '')
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => Number.isFinite(d) && d > 0)

    const validationResult = rangeSchema.safeParse({
      locationId: searchParams.get('locationId'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      offeringId: searchParams.get('offeringId') || undefined,
      preferredStaffId: searchParams.get('preferredStaffId') || undefined,
      duration: searchParams.get('duration') ? parseInt(searchParams.get('duration')!, 10) : undefined,
      durations: durationsRaw.length > 0 ? durationsRaw : undefined,
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { locationId, from, to, offeringId, preferredStaffId, duration, durations } =
      validationResult.data

    const fromDate = parse(from, 'yyyy-MM-dd', new Date())
    const toDate = parse(to, 'yyyy-MM-dd', new Date())
    if (toDate < fromDate) {
      return NextResponse.json({ error: '`to` liegt vor `from`' }, { status: 400 })
    }
    // Sichtbarer Zeitraum begrenzen, sonst kann ein riesiges `to` die Schleife sprengen.
    const rangeDays = Math.min(differenceInCalendarDays(toDate, fromDate) + 1, MAX_RANGE_DAYS)
    const lastVisibleDate = addDays(fromDate, rangeDays - 1)

    // Mehrere Personen, sobald Dauern übergeben werden; sonst Einzelperson.
    const isMulti = Array.isArray(durations) && durations.length > 0
    if (!isMulti && !duration) {
      return NextResponse.json({ error: '`duration` oder `durations` erforderlich' }, { status: 400 })
    }

    const now = new Date()
    const timezone =
      (isDemoLocationId(locationId)
        ? demoLocations.find((l) => l.id === locationId)?.timezone
        : undefined) || 'Europe/Berlin'

    // Bis hierhin scannen wir für "nächster freier Termin" (über den sichtbaren
    // Zeitraum hinaus). Buchungen/Blocks werden für genau dieses Fenster geladen.
    const scanEndDate = (() => {
      const horizonEnd = addDays(fromDate, NEXT_AVAILABLE_HORIZON_DAYS - 1)
      return horizonEnd > lastVisibleDate ? horizonEnd : lastVisibleDate
    })()

    // ---- Demo-Standort: keine DB. Offene Tage gelten als frei. ----
    if (isDemoLocationId(locationId)) {
      const demoLocation = demoLocations.find((l) => l.id === locationId)
      const settings = demoLocation?.settings ?? {}
      const openingHours: any[] = settings.openingHours ?? []

      const days: DayAvailability[] = []
      let nextAvailableDate: string | null = null

      for (let i = 0; i <= differenceInCalendarDays(scanEndDate, fromDate); i++) {
        const dayDate = addDays(fromDate, i)
        const dateStr = format(dayDate, 'yyyy-MM-dd')
        const dayOfWeek = dayDate.getDay()
        const closedReason = await resolveClosedReason(settings, dateStr)
        const exceptionWindow = getExceptionWindow(settings, dateStr)
        const todayHours = openingHours.find((h: any) => h.day === dayOfWeek)
        const locationClosedToday = todayHours?.closed === true
        const isPast = differenceInCalendarDays(dayDate, now) < 0
        const closed = !!closedReason || (!exceptionWindow && locationClosedToday)
        const available = !closed && !isPast
        if (available && !nextAvailableDate) nextAvailableDate = dateStr
        if (i < rangeDays) {
          days.push({ date: dateStr, available, closed, closedReason: closedReason ?? null })
        }
        if (nextAvailableDate && i >= rangeDays - 1) break
      }

      return NextResponse.json({ from, to: format(lastVisibleDate, 'yyyy-MM-dd'), days, nextAvailableDate })
    }

    const client = getSupabaseAdmin()

    const { data: location, error: locError } = (await client
      .from('locations')
      .select('timezone, settings')
      .eq('id', locationId)
      .single()) as any

    if (locError || !location) {
      return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
    }

    const tz = location.timezone || 'Europe/Berlin'
    const settings = location.settings ?? {}
    const openingHours: any[] = settings.openingHours ?? []

    // Aktive Mitarbeiter (optional auf den Wunsch-Mitarbeiter eingeschränkt).
    let staffQuery = client
      .from('resources')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('type', 'staff')
      .eq('is_active', true)
    if (preferredStaffId) staffQuery = staffQuery.eq('id', preferredStaffId)

    const { data: staffMembers, error: staffError } = (await staffQuery) as any
    if (staffError) throw staffError

    // Keine (passenden) Mitarbeiter → der ganze Zeitraum ist leer.
    if (!staffMembers || staffMembers.length === 0) {
      const days: DayAvailability[] = []
      for (let i = 0; i < rangeDays; i++) {
        const dateStr = format(addDays(fromDate, i), 'yyyy-MM-dd')
        days.push({ date: dateStr, available: false, closed: false })
      }
      return NextResponse.json({
        from,
        to: format(lastVisibleDate, 'yyyy-MM-dd'),
        days,
        nextAvailableDate: null,
      })
    }

    const staffIds = staffMembers.map((s: any) => s.id)

    const windowStart = new Date(`${from}T00:00:00.000Z`)
    const windowEnd = new Date(`${format(scanEndDate, 'yyyy-MM-dd')}T23:59:59.999Z`)

    // Wochenpläne aller Mitarbeiter (alle Wochentage; pro Tag in-memory gefiltert).
    const { data: schedules, error: schedError } = (await client
      .from('schedules')
      .select('start_time, end_time, resource_id, day_of_week')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .in('resource_id', staffIds)) as any
    if (schedError) throw schedError

    // Buchungen im Scan-Fenster. Einzelperson spiegelt /enhanced und filtert je
    // Offering; Sammelbuchung spiegelt /cart und betrachtet ALLE Buchungen.
    let bookingQuery = client
      .from('bookings')
      .select('start_time, end_time, resource_id')
      .eq('location_id', locationId)
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .in('resource_id', staffIds)
    if (!isMulti && offeringId) bookingQuery = bookingQuery.eq('offering_id', offeringId)

    const { data: bookings, error: bookError } = (await bookingQuery) as any
    if (bookError) throw bookError

    // Blocks (Urlaub/Krankheit/Pause), die das Fenster überlappen.
    const { data: blocks, error: blockError } = (await client
      .from('blocks')
      .select('start_time, end_time, resource_id')
      .lte('start_time', windowEnd.toISOString())
      .gte('end_time', windowStart.toISOString())) as any
    if (blockError) throw blockError

    const distinctDurations = isMulti ? Array.from(new Set(durations)) : [duration!]
    const durationsDesc = isMulti ? [...durations].sort((a, b) => b - a) : [duration!]
    const minDuration = Math.min(...distinctDurations)

    // Arbeitsfenster (UTC) eines Mitarbeiters an einem Tag.
    const windowsForStaff = (staffId: string, dateStr: string, dayOfWeek: number) => {
      const exceptionWindow = getExceptionWindow(settings, dateStr)
      const todayHours = openingHours.find((h: any) => h.day === dayOfWeek)
      const fallbackSchedule =
        todayHours && !todayHours.closed && todayHours.open && todayHours.close
          ? { start_time: `${todayHours.open}:00`, end_time: `${todayHours.close}:00` }
          : {
              start_time: `${String(BUSINESS_HOURS.start).padStart(2, '0')}:00:00`,
              end_time: `${String(BUSINESS_HOURS.end).padStart(2, '0')}:00:00`,
            }
      const locationClosedToday = todayHours?.closed === true

      const staffSchedules = (schedules || []).filter(
        (s: any) => s.resource_id === staffId && s.day_of_week === dayOfWeek
      )

      let raw: { start_time: string; end_time: string }[]
      if (exceptionWindow) {
        raw = [{ start_time: `${exceptionWindow.open}:00`, end_time: `${exceptionWindow.close}:00` }]
      } else if (staffSchedules.length > 0) {
        raw = staffSchedules
      } else if (!locationClosedToday) {
        raw = [fallbackSchedule]
      } else {
        raw = []
      }

      return raw.map((s) => {
        const [sh, sm] = s.start_time.split(':').map(Number)
        const [eh, em] = s.end_time.split(':').map(Number)
        return { start: zonedTimeToUtc(dateStr, sh, sm, tz), end: zonedTimeToUtc(dateStr, eh, em, tz) }
      })
    }

    // Busy-Intervalle hängen nicht vom Tag ab → einmal je Mitarbeiter vorab.
    const busyByStaff = new Map<string, { start: Date; end: Date }[]>()
    for (const s of staffMembers) {
      busyByStaff.set(s.id, [
        ...(bookings || [])
          .filter((b: any) => b.resource_id === s.id)
          .map((b: any) => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
        ...(blocks || [])
          .filter((b: any) => !b.resource_id || b.resource_id === s.id)
          .map((b: any) => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
      ])
    }

    const isFree = (
      windows: { start: Date; end: Date }[],
      busy: { start: Date; end: Date }[],
      slotStart: Date,
      durationMin: number
    ) => {
      const slotEnd = addMinutes(slotStart, durationMin)
      const fitsWindow = windows.some(
        (w) => w.start.getTime() <= slotStart.getTime() && slotEnd.getTime() <= w.end.getTime()
      )
      if (!fitsWindow) return false
      for (const b of busy) {
        if (slotStart < b.end && slotEnd > b.start) return false
      }
      return true
    }

    // Hat dieser Tag mindestens einen buchbaren Slot? (Early-exit beim ersten Treffer.)
    const dayHasAvailability = (dateStr: string): boolean => {
      const dayOfWeek = parse(dateStr, 'yyyy-MM-dd', new Date()).getDay()

      const staffState = staffMembers.map((s: any) => ({
        id: s.id,
        windows: windowsForStaff(s.id, dateStr, dayOfWeek),
        busy: busyByStaff.get(s.id) || [],
      }))

      // Kandidaten-Startzeiten: 30-Minuten-Raster über alle Arbeitsfenster.
      const candidateStarts = new Map<number, Date>()
      for (const st of staffState) {
        for (const w of st.windows) {
          let t = new Date(w.start)
          while (t.getTime() + minDuration * 60000 <= w.end.getTime()) {
            candidateStarts.set(t.getTime(), new Date(t))
            t = addMinutes(t, 30)
          }
        }
      }

      const sortedStarts = Array.from(candidateStarts.values()).sort(
        (a, b) => a.getTime() - b.getTime()
      )

      for (const slotStart of sortedStarts) {
        if (!isFutureBookingStart(slotStart, now)) continue

        if (!isMulti) {
          // Einzelperson: irgendein Mitarbeiter für die Dauer frei.
          for (const st of staffState) {
            if (isFree(st.windows, st.busy, slotStart, duration!)) return true
          }
          continue
        }

        // Sammelbuchung: Hall-Bedingung – Position k (absteigend sortiert) braucht
        // mind. k gleichzeitig freie Mitarbeiter für ihre Dauer.
        const freeCount = new Map<number, number>()
        for (const d of distinctDurations) {
          freeCount.set(
            d,
            staffState.reduce(
              (n: number, st: any) => n + (isFree(st.windows, st.busy, slotStart, d) ? 1 : 0),
              0
            )
          )
        }
        let feasible = true
        for (let k = 0; k < durationsDesc.length; k++) {
          if ((freeCount.get(durationsDesc[k]) ?? 0) < k + 1) {
            feasible = false
            break
          }
        }
        if (feasible) return true
      }

      return false
    }

    const days: DayAvailability[] = []
    let nextAvailableDate: string | null = null
    const totalScanDays = differenceInCalendarDays(scanEndDate, fromDate) + 1

    for (let i = 0; i < totalScanDays; i++) {
      const dayDate = addDays(fromDate, i)
      const dateStr = format(dayDate, 'yyyy-MM-dd')

      const closedReason = await resolveClosedReason(settings, dateStr)
      let available = false
      if (!closedReason) {
        available = dayHasAvailability(dateStr)
      }

      if (available && !nextAvailableDate) nextAvailableDate = dateStr
      if (i < rangeDays) {
        days.push({ date: dateStr, available, closed: !!closedReason, closedReason: closedReason ?? null })
      }

      // Sobald der sichtbare Zeitraum gefüllt ist UND ein nächster freier Tag
      // gefunden wurde, ist nichts weiter zu scannen.
      if (i >= rangeDays - 1 && nextAvailableDate) break
    }

    return NextResponse.json({
      from,
      to: format(lastVisibleDate, 'yyyy-MM-dd'),
      days,
      nextAvailableDate,
    })
  } catch (error) {
    console.error('Error calculating range availability:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
