'use client'

/**
 * Datumsauswahl für die öffentliche Buchung – angelehnt an große Buchungs-
 * plattformen (Treatwell, Fresha, Booksy):
 *
 * 1. Horizontale Tages-Leiste der nächsten Tage mit Verfügbarkeits-Punkt, damit
 *    man nah liegende Termine ohne Tippen durch einzelne Tage findet.
 * 2. Antippbares Monats-Popover (Kalender), in dem ausgebuchte/geschlossene Tage
 *    ausgegraut sind – so springt man direkt zu einem freien Tag, statt sich Tag
 *    für Tag durchzuklicken.
 *
 * Die Tages-Verfügbarkeit (`dayInfo`) liefert die Elternkomponente aus
 * /api/availability/range. Über `onRangeNeeded` fordert der Picker die Daten für
 * den jeweils sichtbaren Zeitraum an; die Elternkomponente dedupliziert.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  parse,
  startOfDay,
  startOfMonth,
} from 'date-fns'

export interface DayInfo {
  available: boolean
  closed: boolean
}

interface AvailabilityDatePickerProps {
  selectedDate: Date
  onSelect: (date: Date) => void
  /** Tages-Verfügbarkeit, keyed nach 'yyyy-MM-dd'. */
  dayInfo: Record<string, DayInfo>
  /** Fordert Tages-Daten für [from, to] an (yyyy-MM-dd). */
  onRangeNeeded: (fromStr: string, toStr: string) => void
  /** Frühester wählbarer Tag (Default: heute). */
  minDate?: Date
  /** Tages-Daten werden gerade geladen (zeigt dezentes Pulsieren). */
  loading?: boolean
}

const STRIP_DAYS = 21
const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const dateKey = (d: Date) => format(d, 'yyyy-MM-dd')
/** Monday-first column index (0..6) for a JS date. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

export function AvailabilityDatePicker({
  selectedDate,
  onSelect,
  dayInfo,
  onRangeNeeded,
  minDate,
  loading = false,
}: AvailabilityDatePickerProps) {
  const today = useMemo(() => startOfDay(minDate ?? new Date()), [minDate])
  const selected = startOfDay(selectedDate)

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(selected))
  const stripRef = useRef<HTMLDivElement>(null)

  const selectedKey = dateKey(selected)
  // Tages-Leiste: ab heute, oder ab dem gewählten Tag, falls dieser weiter weg ist.
  const stripStart = selected > addDays(today, STRIP_DAYS - 1) ? selected : today
  const stripStartKey = dateKey(stripStart)
  const viewMonthKey = dateKey(startOfMonth(viewMonth))

  // onRangeNeeded kann bei jedem Render eine neue Funktion sein – über eine Ref
  // referenzieren, damit die Lade-Effekte nicht endlos feuern.
  const onRangeNeededRef = useRef(onRangeNeeded)
  useEffect(() => {
    onRangeNeededRef.current = onRangeNeeded
  })

  // Springt der Nutzer (z. B. über "nächster freier Termin") in einen anderen
  // Monat, zieht das Kalender-Popover nach.
  useEffect(() => {
    setViewMonth(startOfMonth(parse(selectedKey, 'yyyy-MM-dd', new Date())))
  }, [selectedKey])

  const stripDays = useMemo(
    () => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(parse(stripStartKey, 'yyyy-MM-dd', new Date()), i)),
    [stripStartKey]
  )

  // Daten für die Leiste anfordern.
  useEffect(() => {
    onRangeNeededRef.current(stripStartKey, dateKey(addDays(stripStart, STRIP_DAYS - 1)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripStartKey])

  // Daten für den sichtbaren Kalendermonat anfordern (sobald geöffnet).
  useEffect(() => {
    if (!calendarOpen) return
    onRangeNeededRef.current(viewMonthKey, dateKey(endOfMonth(viewMonth)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarOpen, viewMonthKey])

  function pick(date: Date) {
    onSelect(startOfDay(date))
    setCalendarOpen(false)
  }

  function scrollStrip(direction: -1 | 1) {
    stripRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' })
  }

  // Status eines Tages für die Darstellung.
  type DayState = 'past' | 'closed' | 'available' | 'unavailable' | 'unknown'
  function dayState(date: Date): DayState {
    if (startOfDay(date) < today) return 'past'
    const info = dayInfo[dateKey(date)]
    if (!info) return 'unknown'
    if (info.closed) return 'closed'
    return info.available ? 'available' : 'unavailable'
  }

  const monthTitle = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(
    viewMonth
  )

  // Monatsgitter (mit führenden Leerzellen, Montag zuerst).
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const leadingBlanks = mondayIndex(monthStart)
  const gridCells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: monthEnd.getDate() }, (_, i) => addDays(monthStart, i)),
  ]
  const canGoPrevMonth = startOfMonth(addMonths(viewMonth, -1)) >= startOfMonth(today)

  return (
    <div className="relative space-y-3">
      {/* Kopf: gewählter Tag öffnet die Monatsansicht */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-slate-700/80 dark:bg-slate-800/50">
        <button
          type="button"
          onClick={() => setCalendarOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white dark:hover:bg-slate-800"
          aria-expanded={calendarOpen}
          aria-label="Monatsansicht öffnen"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <Calendar className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Gewählter Tag
            </span>
            <span className="block truncate font-bold capitalize text-slate-950 dark:text-white">
              {new Intl.DateTimeFormat('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(selected)}
            </span>
          </span>
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${calendarOpen ? 'rotate-90' : ''}`}
          />
        </button>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/80 p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-slate-700">
          <button
            type="button"
            onClick={() => scrollStrip(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Frühere Tage"
          >
            <ChevronLeft className="h-5 w-5 text-slate-500 dark:text-slate-300" />
          </button>
          <button
            type="button"
            onClick={() => scrollStrip(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Spätere Tage"
          >
            <ChevronRight className="h-5 w-5 text-slate-500 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* Horizontale Tages-Leiste */}
      <div
        ref={stripRef}
        aria-label="Tagesleiste"
        className={calendarOpen
          ? 'hidden'
          : '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}
      >
        {stripDays.map((day) => {
          const state = dayState(day)
          const isSelected = isSameDay(day, selected)
          const disabled = state === 'past' || state === 'closed' || state === 'unavailable'
          return (
            <button
              key={dateKey(day)}
              type="button"
              onClick={() => !disabled && pick(day)}
              disabled={disabled && !isSelected}
              className={`flex h-16 min-w-[3rem] flex-col items-center justify-center rounded-xl border px-2 transition-all ${
                isSelected
                  ? 'border-blue-600 bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md shadow-blue-600/20'
                  : disabled
                    ? 'border-transparent bg-transparent text-slate-300 dark:text-slate-600'
                    : 'border-slate-200 bg-white/90 text-slate-700 shadow-sm shadow-slate-950/5 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-blue-500/70 dark:hover:bg-blue-950/30'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {WEEKDAYS_SHORT[mondayIndex(day)]}
              </span>
              <span className="text-lg font-bold leading-tight">{day.getDate()}</span>
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  isSelected
                    ? 'bg-white'
                    : state === 'available'
                      ? 'bg-green-500'
                      : 'bg-transparent'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* Ausgeklappte Monatsansicht */}
      {calendarOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setCalendarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-40 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => canGoPrevMonth && setViewMonth(addMonths(viewMonth, -1))}
                disabled={!canGoPrevMonth}
                className="flex h-9 w-9 items-center justify-center rounded-lg enabled:hover:bg-slate-100 disabled:opacity-30 dark:enabled:hover:bg-slate-800"
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-5 w-5 dark:text-white" />
              </button>
              <span className="font-bold capitalize text-slate-950 dark:text-white">
                {monthTitle}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Nächster Monat"
              >
                <ChevronRight className="h-5 w-5 dark:text-white" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS_SHORT.map((wd) => (
                <div
                  key={wd}
                  className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className={`grid grid-cols-7 gap-1 ${loading ? 'animate-pulse' : ''}`}>
              {gridCells.map((day, idx) => {
                if (!day) return <div key={`blank-${idx}`} />
                const state = dayState(day)
                const isSelected = isSameDay(day, selected)
                const isToday = isSameDay(day, today)
                const selectable = state === 'available' || state === 'unknown'
                return (
                  <button
                    key={dateKey(day)}
                    type="button"
                    onClick={() => selectable && pick(day)}
                    disabled={!selectable}
                    className={`relative flex h-10 items-center justify-center rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-b from-blue-500 to-blue-600 font-bold text-white shadow-sm shadow-blue-600/20'
                        : state === 'available'
                          ? 'font-semibold text-slate-950 hover:bg-blue-100 dark:text-white dark:hover:bg-blue-950/40'
                          : state === 'unknown'
                            ? 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                            : 'text-slate-300 line-through dark:text-slate-600'
                    } ${isToday && !isSelected ? 'ring-1 ring-blue-400' : ''}`}
                  >
                    {day.getDate()}
                    {state === 'available' && !isSelected && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-green-500" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> frei
              </span>
              <span className="flex items-center gap-1">
                <span className="text-gray-300 line-through dark:text-gray-600">12</span> belegt /
                geschlossen
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
