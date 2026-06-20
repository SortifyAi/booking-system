'use client'

import { use, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Calendar, Clock, User, MapPin, Check, AlertCircle, XCircle, CalendarPlus } from 'lucide-react'
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from '@/lib/calendar-links'
import { DEFAULT_TIMEZONE, formatDateInTimeZone, formatTimeInTimeZone } from '@/lib/timezone'

interface BookingItem {
  serviceName: string | null
  staffName: string | null
  durationMinutes: number | null
  priceCents: number | null
  addons: { name: string; priceCents: number | null }[]
}

interface ManagedBooking {
  customerName: string
  startTime: string
  endTime: string
  status: string
  serviceName: string | null
  priceCents: number | null
  durationMinutes: number | null
  staffName: string | null
  locationName: string | null
  locationAddress: string | null
  timezone: string | null
  organizationName: string | null
  organizationLogoUrl: string | null
  isGroup?: boolean
  items?: BookingItem[]
  addons?: { name: string; priceCents: number | null }[]
  totalPriceCents?: number | null
  offeringId: string
  locationId: string
  resourceId: string | null
}

interface AvailableSlot {
  startTime: string
  endTime: string
  available: boolean
}

/** Local calendar date (YYYY-MM-DD) for a Date – avoids the UTC day shift. */
function toDateInputValue(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

export default function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [booking, setBooking] = useState<ManagedBooking | null>(null)
  const [canCancel, setCanCancel] = useState(false)
  const [canReschedule, setCanReschedule] = useState(false)
  const [cutoffHours, setCutoffHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  // Reschedule flow
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [closedReason, setClosedReason] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/public/bookings/${token}`)
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const data = await res.json()
        setBooking(data.booking)
        setCanCancel(data.canCancel)
        setCanReschedule(data.canReschedule)
        setCutoffHours(data.cutoffHours)
        if (data.booking?.status === 'cancelled') setCancelled(true)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  async function loadSlots(date: string) {
    if (!booking) return
    setSlotsLoading(true)
    setClosedReason(null)
    setSelectedSlot(null)
    try {
      const params = new URLSearchParams({
        locationId: booking.locationId,
        offeringId: booking.offeringId,
        date,
      })
      if (booking.resourceId) params.set('staffId', booking.resourceId)
      else params.set('aggregated', 'true')

      const res = await fetch(`/api/availability/enhanced?${params}`)
      const data = await res.json()

      if (data.closed) {
        setClosedReason(data.closedReason || 'An diesem Tag geschlossen')
        setSlots([])
        return
      }

      // Individual (same staff) vs. aggregated (no fixed staff) response shapes.
      let raw: AvailableSlot[] = []
      if (data.type === 'individual') {
        raw = data.staffMember?.slots ?? []
      } else if (data.type === 'aggregated') {
        const byStart = new Map<string, AvailableSlot>()
        for (const staff of data.staffDetails ?? []) {
          for (const s of staff.slots ?? []) {
            const existing = byStart.get(s.startTime)
            if (!existing || (s.available && !existing.available)) byStart.set(s.startTime, s)
          }
        }
        raw = Array.from(byStart.values())
      }

      setSlots(
        raw
          .filter((s) => s.available)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      )
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  function openReschedule() {
    if (!booking) return
    const initial = toDateInputValue(new Date(booking.startTime))
    setRescheduleOpen(true)
    setRescheduleDate(initial)
    loadSlots(initial)
  }

  function onRescheduleDateChange(date: string) {
    setRescheduleDate(date)
    if (date) loadSlots(date)
  }

  async function handleReschedule() {
    if (!selectedSlot) return
    setRescheduling(true)
    try {
      const res = await fetch(`/api/public/bookings/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: selectedSlot }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'SLOT_TAKEN') {
          toast.error('Dieser Termin ist leider schon vergeben. Bitte wählen Sie einen anderen.')
          if (rescheduleDate) loadSlots(rescheduleDate)
        } else if (data.reason === 'cutoff') {
          toast.error(`Verschieben nur bis ${data.cutoffHours} Std. vor dem Termin möglich.`)
          setCanReschedule(false)
          setRescheduleOpen(false)
        } else {
          toast.error('Verschieben fehlgeschlagen. Bitte versuchen Sie es erneut.')
        }
        return
      }
      setBooking((prev) =>
        prev ? { ...prev, startTime: data.startTime, endTime: data.endTime } : prev
      )
      setRescheduleOpen(false)
      toast.success('Ihr Termin wurde verschoben.')
    } catch {
      toast.error('Verschieben fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setRescheduling(false)
    }
  }

  async function handleCancel() {
    if (!confirm('Möchten Sie diesen Termin wirklich stornieren?')) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/public/bookings/${token}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.reason === 'cutoff') {
          toast.error(`Online-Stornierung nur bis ${data.cutoffHours} Std. vor dem Termin möglich.`)
          setCanCancel(false)
        } else {
          toast.error('Stornierung fehlgeschlagen. Bitte versuchen Sie es erneut.')
        }
        return
      }
      setCancelled(true)
      toast.success('Termin wurde storniert.')
    } catch {
      toast.error('Stornierung fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setCancelling(false)
    }
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  }

  // Always render in the location's timezone so the wall-clock time matches the
  // confirmation email and the salon's local time, independent of the visitor's
  // device timezone.
  const tz = booking?.timezone || DEFAULT_TIMEZONE

  function formatDate(iso: string) {
    return formatDateInTimeZone(iso, tz)
  }

  function formatTime(iso: string) {
    return formatTimeInTimeZone(iso, tz)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Wird geladen...</div>
      </div>
    )
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Termin nicht gefunden</h1>
          <p className="text-gray-500 dark:text-gray-400">Dieser Link ist ungültig oder abgelaufen.</p>
        </div>
      </div>
    )
  }

  const calEvent = {
    uid: `booking-${token}@bookanord`,
    title: [booking.serviceName, booking.organizationName].filter(Boolean).join(' – ') || 'Termin',
    description: `Ihr Termin${booking.organizationName ? ` bei ${booking.organizationName}` : ''}.`,
    location: [booking.locationName, booking.locationAddress].filter(Boolean).join(', '),
    start: booking.startTime,
    end: booking.endTime,
  }
  const googleUrl = buildGoogleCalendarUrl(calEvent)
  const outlookUrl = buildOutlookCalendarUrl(calEvent)
  const icsUrl = `/api/public/bookings/${token}/ics`

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          {booking.organizationLogoUrl ? (
            <img
              src={booking.organizationLogoUrl}
              alt={`${booking.organizationName ?? ''} Logo`}
              className="h-16 w-auto max-w-[200px] object-contain mx-auto mb-4"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {booking.organizationName || 'Ihr Termin'}
            </h1>
          )}
          <p className="text-gray-600 dark:text-gray-300">Terminübersicht</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          {cancelled ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold mb-2 dark:text-white">Termin storniert</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Dieser Termin wurde storniert. Sie können jederzeit einen neuen Termin buchen.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 text-gray-700 dark:text-gray-200">
                {(booking.items && booking.items.length > 0
                  ? booking.items
                  : [{
                      serviceName: booking.serviceName,
                      staffName: booking.staffName,
                      priceCents: booking.priceCents,
                      durationMinutes: booking.durationMinutes,
                      addons: booking.addons ?? [],
                    } as BookingItem]
                ).map((item, idx) => (
                  <div key={idx} className="rounded-lg bg-gray-50 dark:bg-slate-700/40 p-3">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <span className="font-medium">
                        {booking.isGroup && <span className="text-gray-500">Person {idx + 1}: </span>}
                        {item.serviceName}
                      </span>
                      {item.priceCents != null && (
                        <span className="ml-auto text-gray-500">{formatPrice(item.priceCents)}</span>
                      )}
                    </div>
                    {item.addons && item.addons.length > 0 && (
                      <div className="ml-8 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        + {item.addons.map((a) => a.name).join(', ')}
                      </div>
                    )}
                    {item.staffName && (
                      <div className="ml-8 mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <User className="w-4 h-4" /> {item.staffName}
                      </div>
                    )}
                  </div>
                ))}
                {booking.isGroup && booking.totalPriceCents != null && (
                  <div className="flex items-center gap-3 font-semibold">
                    <span>Gesamt</span>
                    <span className="ml-auto">{formatPrice(booking.totalPriceCents)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span>{formatDate(booking.startTime)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>{formatTime(booking.startTime)} – {formatTime(booking.endTime)} Uhr</span>
                </div>
                {booking.locationName && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <span>
                      {booking.locationName}
                      {booking.locationAddress ? <span className="text-gray-500"> · {booking.locationAddress}</span> : null}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  <CalendarPlus className="w-5 h-5 text-blue-600" />
                  <span>Zum Kalender hinzufügen</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Google
                  </a>
                  <a
                    href={icsUrl}
                    className="inline-flex items-center rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Apple Kalender
                  </a>
                  <a
                    href={outlookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Outlook
                  </a>
                </div>
              </div>

              {canReschedule && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span>Termin verschieben</span>
                  </div>

                  {!rescheduleOpen ? (
                    <Button variant="outline" className="w-full" onClick={openReschedule}>
                      Anderen Termin wählen
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Datum</label>
                        <input
                          type="date"
                          value={rescheduleDate}
                          min={toDateInputValue(new Date())}
                          onChange={(e) => onRescheduleDateChange(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      {slotsLoading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Freie Zeiten werden geladen...</p>
                      ) : closedReason ? (
                        <p className="text-sm text-amber-700 dark:text-amber-300">{closedReason}</p>
                      ) : slots.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          An diesem Tag sind keine freien Zeiten verfügbar. Bitte wählen Sie einen anderen Tag.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {slots.map((slot) => {
                            const isSelected = selectedSlot === slot.startTime
                            return (
                              <button
                                key={slot.startTime}
                                onClick={() => setSelectedSlot(slot.startTime)}
                                className={`rounded-md border px-2 py-2 text-sm transition-colors ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-100 hover:border-blue-400'
                                }`}
                              >
                                {formatTime(slot.startTime)}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={handleReschedule}
                          disabled={!selectedSlot || rescheduling}
                        >
                          {rescheduling ? 'Wird verschoben...' : 'Auf neue Zeit verschieben'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setRescheduleOpen(false)}
                          disabled={rescheduling}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                {canCancel ? (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Wird storniert...' : 'Termin stornieren'}
                  </Button>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
                    <div className="font-medium mb-1">Online-Stornierung nicht mehr möglich</div>
                    <div>
                      Eine Stornierung ist nur bis {cutoffHours} Stunden vor dem Termin online möglich.
                      Bitte kontaktieren Sie {booking.organizationName || 'den Salon'} direkt
                      {booking.locationAddress ? ` (${booking.locationAddress})` : ''}.
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
