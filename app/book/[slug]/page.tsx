'use client'

import { use, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResourceAvatar } from '@/components/ResourceAvatar'
import { PublicBookingFooter, PublicBookingPrivacyNotice } from '@/components/PublicBookingLegal'
import { toast } from 'sonner'
import { Calendar, Clock, User, MapPin, ChevronLeft, ChevronRight, Check, AlertCircle, ShoppingCart, Plus, Trash2 } from 'lucide-react'
import { combineStaffAvailabilitySlots } from '@/lib/public-booking'
import {
  BOOKING_IN_PAST_ERROR,
  getShowPrices,
  getShowDuration,
  getRequiredCustomerFields,
  getPrivacyPolicyUrl,
  isFutureBookingStart,
  isSameOrAfterLocalDay,
  withPastSlotsUnavailable,
} from '@/lib/booking-policy'
import { getDemoStaffMembers, isDemoLocationId } from '@/lib/public-demo'
import { DEFAULT_TIMEZONE, formatTimeInTimeZone } from '@/lib/timezone'
import { format } from 'date-fns'
import {
  PublicBookingSubmissionError,
  type BookingSubmissionError,
} from '@/components/PublicBookingSubmissionError'

interface OrgInfo {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  settings?: Record<string, unknown> | null
}

interface Location {
  id: string
  name: string
  address: string
  phone?: string | null
  timezone?: string | null
}

interface Offering {
  id: string
  name: string
  description: string
  duration_minutes: number
  price_cents: number
  color: string
  image_url?: string | null
  available_as_addon?: boolean
}

interface CartItem {
  uid: string
  offering: Offering
  addons: Offering[]
}

interface StaffMember {
  id: string
  name: string
  imageUrl?: string | null
  priority?: number
}

interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
  staffId?: string
  staffName?: string
  staffImageUrl?: string | null
}

function makeUid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function OrgBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = createClient()
  const { slug } = use(params)

  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [orgNotFound, setOrgNotFound] = useState(false)
  const [step, setStep] = useState(1)
  const [locations, setLocations] = useState<Location[]>([])
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const [fallbackSlot, setFallbackSlot] = useState<TimeSlot | null>(null)
  const [closedReason, setClosedReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [manageUrl, setManageUrl] = useState<string | null>(null)
  const [demoSubmission, setDemoSubmission] = useState(false)
  const [submissionError, setSubmissionError] = useState<BookingSubmissionError | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false)

  useEffect(() => {
    setSubmissionError(null)
  }, [customerEmail, selectedLocation?.id])

  const requiredFields = getRequiredCustomerFields(org?.settings)

  // A cart line is one person/appointment: its service plus any add-ons.
  const isMultiPerson = cartItems.length > 1
  const itemDuration = (item: CartItem) =>
    item.offering.duration_minutes + item.addons.reduce((sum, a) => sum + (a.duration_minutes || 0), 0)
  const itemPriceCents = (item: CartItem) =>
    (item.offering.price_cents || 0) + item.addons.reduce((sum, a) => sum + (a.price_cents || 0), 0)
  const cartTotalCents = cartItems.reduce((sum, item) => sum + itemPriceCents(item), 0)
  const addonOfferings = offerings.filter((o) => o.available_as_addon)

  useEffect(() => {
    fetchOrg()
  }, [slug])

  useEffect(() => {
    if (selectedLocation) {
      setCartItems([])
      setStaffMembers([])
      setSelectedStaff(null)
      setAvailableSlots([])
      setSelectedSlot(null)
      setFallbackReason(null)
      setFallbackSlot(null)
      fetchOfferings(selectedLocation.id)
    }
  }, [selectedLocation])

  useEffect(() => {
    if (cartItems.length > 0 && selectedLocation && selectedDate && step >= 4) {
      fetchAvailability()
    }
  }, [cartItems, selectedLocation, selectedDate, selectedStaff, step])

  async function fetchOrg() {
    setLoading(true)
    try {
      const res = await fetch(`/api/public/org/${slug}`)
      if (!res.ok) {
        setOrgNotFound(true)
        return
      }
      const data = await res.json()
      setOrg(data.org)
      const fetchedLocations: Location[] = data.locations ?? []
      setLocations(fetchedLocations)
      if (fetchedLocations.length === 1) {
        setSelectedLocation(fetchedLocations[0])
        setStep(2)
      }
    } catch {
      setOrgNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  async function fetchOfferings(locationId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/public/offerings?location_id=${locationId}`)
      const data = await res.json()
      setOfferings(data.offerings ?? [])
    } catch {
      setOfferings([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchStaffMembers(locationId: string, offeringId: string) {
    setLoading(true)
    try {
      if (isDemoLocationId(locationId)) {
        setStaffMembers(
          getDemoStaffMembers(locationId).map((row, idx) => ({
            id: row.id,
            name: row.name,
            imageUrl: row.image_url,
            priority: idx,
          }))
        )
        return
      }

      const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'
      if (isMock) {
        setStaffMembers([
          {
            id: 'res-anna',
            name: 'Anna Weber',
            imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80',
            priority: 1,
          },
          {
            id: 'res-marc',
            name: 'Marc Schmidt',
            imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
            priority: 2,
          },
          {
            id: 'res-sophie',
            name: 'Sophie Becker',
            imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=240&q=80',
            priority: 3,
          },
        ])
        return
      }

      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('location_id', locationId)
        .eq('type', 'staff')
        .eq('is_active', true)

      if (error) throw error

      const mapped = (data || [])
        .map((row: any, idx: number) => ({
          id: row.id as string,
          name: row.name as string,
          imageUrl: row.image_url as string | null,
          priority: idx,
        }))
        .sort((a: StaffMember, b: StaffMember) => (a.priority ?? 0) - (b.priority ?? 0))

      setStaffMembers(mapped)
    } catch {
      setStaffMembers([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchAvailability() {
    setLoading(true)
    setFallbackReason(null)
    setFallbackSlot(null)
    setClosedReason(null)
    try {
      // Local calendar date (NOT toISOString, which is UTC and shifts the day
      // late in the evening for Europe/Berlin → wrong/missing slots).
      const dateStr = format(selectedDate, 'yyyy-MM-dd')

      // Multiple people: slots where enough staff are simultaneously free.
      if (isMultiPerson) {
        const durations = cartItems.map(itemDuration).join(',')
        const params = new URLSearchParams({
          locationId: selectedLocation!.id,
          date: dateStr,
          durations,
        })
        const res = await fetch(`/api/availability/cart?${params}`)
        const data = await res.json()
        if (data.closed) setClosedReason(data.closedReason || 'Geschlossen')
        setAvailableSlots(withPastSlotsUnavailable(data.slots ?? []))
        return
      }

      // Single person: reuse the enhanced endpoint with the combined duration
      // (service + add-ons) and keep the optional staff preference / smart fallback.
      const mainItem = cartItems[0]
      const duration = String(itemDuration(mainItem))
      const offeringId = mainItem.offering.id

      if (selectedStaff) {
        const params = new URLSearchParams({
          locationId: selectedLocation!.id,
          offeringId,
          date: dateStr,
          mode: 'smart',
          preferredStaffId: selectedStaff.id,
          duration,
        })
        const res = await fetch(`/api/availability/enhanced?${params}`)
        const data = await res.json()
        if (data.closed) setClosedReason(data.closedReason || 'Geschlossen')
        if (data.type === 'smart') {
          setAvailableSlots(
            withPastSlotsUnavailable(
              (data.preferredStaffAvailableSlots || []).map((slot: TimeSlot) => ({
                ...slot,
                available: true,
                staffId: selectedStaff.id,
                staffName: selectedStaff.name,
                staffImageUrl: selectedStaff.imageUrl ?? null,
              }))
            )
          )
          if (data.fallbackNextAvailable) {
            setFallbackReason(data.reason || 'Bevorzugter Mitarbeiter ist nicht verfügbar')
            setFallbackSlot({ ...data.fallbackNextAvailable, available: true })
          }
        }
      } else {
        const params = new URLSearchParams({
          locationId: selectedLocation!.id,
          offeringId,
          date: dateStr,
          aggregated: 'true',
          duration,
        })
        const res = await fetch(`/api/availability/enhanced?${params}`)
        const data = await res.json()
        if (data.closed) setClosedReason(data.closedReason || 'Geschlossen')
        if (data.type === 'aggregated' && data.staffDetails) {
          setAvailableSlots(withPastSlotsUnavailable(combineStaffAvailabilitySlots(data.staffDetails)))
        } else {
          setAvailableSlots(withPastSlotsUnavailable(data.slots ?? []))
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  function addToCart(offering: Offering) {
    setCartItems((prev) => [...prev, { uid: makeUid(), offering, addons: [] }])
  }

  function removeFromCart(uid: string) {
    setCartItems((prev) => prev.filter((item) => item.uid !== uid))
  }

  function toggleAddon(uid: string, addon: Offering) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.uid !== uid) return item
        const has = item.addons.some((a) => a.id === addon.id)
        return {
          ...item,
          addons: has ? item.addons.filter((a) => a.id !== addon.id) : [...item.addons, addon],
        }
      })
    )
  }

  function proceedFromCart() {
    if (cartItems.length === 0) return
    setSelectedSlot(null)
    setSelectedStaff(null)
    setAvailableSlots([])
    if (cartItems.length === 1) {
      setLoading(true)
      fetchStaffMembers(selectedLocation!.id, cartItems[0].offering.id)
      setStep(3)
    } else {
      setLoading(true)
      setStep(4)
    }
  }

  async function handleSubmit() {
    if (!selectedLocation || cartItems.length === 0 || !selectedSlot || !customerName || !customerEmail) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }
    if (requiredFields.phone && !customerPhone.trim()) {
      toast.error('Bitte geben Sie eine Telefonnummer an')
      return
    }
    if (requiredFields.notes && !notes.trim()) {
      toast.error('Bitte füllen Sie das Anmerkungsfeld aus')
      return
    }
    if (!privacyNoticeAccepted) {
      toast.error('Bitte bestätigen Sie die Datenschutzinformationen')
      return
    }
    if (!isFutureBookingStart(selectedSlot.startTime)) {
      toast.error(BOOKING_IN_PAST_ERROR)
      setSelectedSlot(null)
      setStep(4)
      fetchAvailability()
      return
    }

    if (isDemoLocationId(selectedLocation.id)) {
      setSubmitting(true)
      setDemoSubmission(true)
      setManageUrl(null)
      toast.success('Demo-Buchung simuliert. Es wurde kein echter Termin angelegt.')
      setStep(6)
      setSubmitting(false)
      return
    }

    setSubmitting(true)
    setDemoSubmission(false)
    try {
      const body = isMultiPerson
        ? {
            locationId: selectedLocation.id,
            items: cartItems.map((item) => ({
              offeringId: item.offering.id,
              addonIds: item.addons.map((a) => a.id),
            })),
            customerName,
            customerEmail,
            customerPhone: customerPhone || undefined,
            startTime: selectedSlot.startTime,
            notes: notes || undefined,
            privacyNoticeAccepted,
          }
        : {
            locationId: selectedLocation.id,
            offeringId: cartItems[0].offering.id,
            addonIds: cartItems[0].addons.map((a) => a.id),
            resourceId: selectedSlot.staffId || selectedStaff?.id,
            customerName,
            customerEmail,
            customerPhone: customerPhone || undefined,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            notes: notes || undefined,
            privacyNoticeAccepted,
          }

      const res = await fetch('/api/bookings/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json().catch(() => ({}))
      // 409 = the slot was taken by someone else between selection and submit.
      // Send the customer back to the time picker and refresh availability so
      // the now-unavailable slot disappears from the list.
      if (res.status === 409) {
        toast.error('Dieser Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Termin.')
        setSelectedSlot(null)
        setStep(4)
        fetchAvailability()
        return
      }
      if (result.code === 'EMAIL_INVALID') {
        setSubmissionError({ kind: 'email', message: result.message })
        return
      }
      if (result.code === 'CONTACT_SALON') {
        setSubmissionError({
          kind: 'contact',
          message: result.message,
          phone: result.phone || selectedLocation.phone,
        })
        return
      }
      if (!res.ok) throw new Error(result.error || 'Booking failed')
      setManageUrl(result.manageUrl || null)
      toast.success('Buchung erfolgreich! Wir bestätigen per E-Mail.')
      setStep(6)
    } catch {
      toast.error('Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  }

  function formatTime(isoString: string) {
    return formatTimeInTimeZone(isoString, selectedLocation?.timezone || DEFAULT_TIMEZONE)
  }

  const selectedBookingStaff =
    selectedStaff ||
    staffMembers.find((staff) => staff.id === selectedSlot?.staffId) ||
    (selectedSlot?.staffName
      ? {
          id: selectedSlot.staffId || 'selected-staff',
          name: selectedSlot.staffName,
          imageUrl: selectedSlot.staffImageUrl ?? null,
        }
      : null)

  const showPrice = getShowPrices(org?.settings)
  const showDur = getShowDuration(org?.settings)

  if (loading && !org) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Wird geladen...</div>
      </div>
    )
  }

  if (orgNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Seite nicht gefunden</h1>
          <p className="text-gray-500 dark:text-gray-400">Diese Buchungsseite existiert nicht.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-28">
        <div className="text-center mb-8">
          {org?.logo_url ? (
            <img
              src={org.logo_url}
              alt={`${org.name} Logo`}
              className="h-16 w-auto max-w-[200px] object-contain mx-auto mb-4"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {org?.name}
            </h1>
          )}
          <p className="text-gray-600 dark:text-gray-300">
            Termin online buchen
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
              }`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 5 && (
                <div className={`w-12 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">1. Standort auswählen</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => { setSelectedLocation(loc); setStep(2) }}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:border-blue-500 ${
                      selectedLocation?.id === loc.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium dark:text-white">{loc.name}</div>
                        <div className="text-sm text-gray-500">{loc.address}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Services / Cart */}
        {step === 2 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700">
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-1 dark:text-white">2. Leistungen auswählen</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Mehrere Leistungen für mehrere Personen? Einfach mehrfach hinzufügen.
            </p>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                {offerings.map((offering) => {
                  const inCart = cartItems.filter((c) => c.offering.id === offering.id).length
                  const hasMeta = showPrice || showDur
                  return (
                    <div
                      key={offering.id}
                      className="w-full p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 transition-all"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {offering.image_url ? (
                            <img
                              src={offering.image_url}
                              alt={`${offering.name} Bild`}
                              className="h-14 w-14 flex-shrink-0 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-slate-700"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="h-3 w-3 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: offering.color }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium dark:text-white">
                              {offering.name}
                              {offering.available_as_addon && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                  auch als Zusatz
                                </span>
                              )}
                            </div>
                            {offering.description && (
                              <div className="text-sm text-gray-500">{offering.description}</div>
                            )}
                            {hasMeta && (
                              <div className="mt-0.5 text-sm text-gray-500">
                                {showPrice && <span className="font-semibold dark:text-gray-300">{formatPrice(offering.price_cents)}</span>}
                                {showPrice && showDur && ' · '}
                                {showDur && <span>{offering.duration_minutes} Min.</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => addToCart(offering)}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4" />
                          {inCart > 0 ? `${inCart}×` : 'Hinzufügen'}
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Cart */}
                {cartItems.length > 0 && (
                  <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold dark:text-white">
                      <ShoppingCart className="h-5 w-5 text-blue-600" /> Ihre Auswahl
                    </h3>
                    <div className="space-y-3">
                      {cartItems.map((item, idx) => (
                        <div key={item.uid} className="rounded-lg bg-white p-3 ring-1 ring-gray-200 dark:bg-slate-800 dark:ring-slate-700">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium dark:text-white">
                                {cartItems.length > 1 && <span className="text-gray-400">{idx + 1}. </span>}
                                {item.offering.name}
                              </div>
                              {showPrice && (
                                <div className="text-sm text-gray-500">{formatPrice(itemPriceCents(item))}</div>
                              )}
                            </div>
                            <button
                              onClick={() => removeFromCart(item.uid)}
                              className="flex-shrink-0 text-gray-400 hover:text-red-600"
                              title="Entfernen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Add-ons for this line */}
                          {addonOfferings.filter((a) => a.id !== item.offering.id).length > 0 && (
                            <div className="mt-2 border-t border-gray-100 pt-2 dark:border-slate-700">
                              <div className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                Zusatzleistungen (optional)
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {addonOfferings
                                  .filter((a) => a.id !== item.offering.id)
                                  .map((addon) => {
                                    const active = item.addons.some((a) => a.id === addon.id)
                                    return (
                                      <button
                                        key={addon.id}
                                        onClick={() => toggleAddon(item.uid, addon)}
                                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                          active
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-200'
                                        }`}
                                      >
                                        {active ? '✓ ' : '+ '}
                                        {addon.name}
                                        {showPrice && addon.price_cents ? ` (${formatPrice(addon.price_cents)})` : ''}
                                      </button>
                                    )
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Staff (single person only) */}
        {step === 3 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <button onClick={() => setStep(2)} className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700">
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">3. Mitarbeiter auswählen</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => { setSelectedStaff(null); setLoading(true); setStep(4) }}
                  className="w-full p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 text-left hover:border-blue-500 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium dark:text-white">Keine Präferenz</div>
                      <div className="text-sm text-gray-500">Beliebiger Mitarbeiter</div>
                    </div>
                  </div>
                </button>
                {staffMembers.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => { setSelectedStaff(staff); setLoading(true); setStep(4) }}
                    className={`w-full p-3 sm:p-4 rounded-xl border-2 text-left transition-all hover:border-blue-500 hover:shadow-sm ${
                      selectedStaff?.id === staff.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ResourceAvatar
                        name={staff.name}
                        imageUrl={staff.imageUrl}
                        className="h-14 w-14"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white">{staff.name}</div>
                        <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                          Persönliche Auswahl
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Date & Time */}
        {step === 4 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <button onClick={() => setStep(isMultiPerson ? 2 : 3)} className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700">
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">4. Datum & Uhrzeit</h2>
            {isMultiPerson && (
              <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                Für {cartItems.length} Personen – es werden nur Zeiten angezeigt, an denen genügend Mitarbeiter gleichzeitig frei sind.
              </p>
            )}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  const d = new Date(selectedDate)
                  d.setDate(d.getDate() - 1)
                  if (isSameOrAfterLocalDay(d)) { setLoading(true); setSelectedDate(d) }
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ChevronLeft className="w-5 h-5 dark:text-white" />
              </button>
              <span className="font-medium dark:text-white">
                {selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              <button
                onClick={() => {
                  const d = new Date(selectedDate)
                  d.setDate(d.getDate() + 1)
                  setLoading(true)
                  setSelectedDate(d)
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ChevronRight className="w-5 h-5 dark:text-white" />
              </button>
            </div>
            {loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 rounded-lg bg-gray-200 dark:bg-slate-700 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <>
                {closedReason && (
                  <div className="mb-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 p-4 text-center">
                    <div className="font-medium text-gray-900 dark:text-white">An diesem Tag geschlossen</div>
                    {closedReason !== 'Geschlossen' && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{closedReason}</div>
                    )}
                  </div>
                )}
                {fallbackReason && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-medium">Hinweis</div>
                    <div>
                      {fallbackReason}
                      {fallbackSlot && <> Nächster Termin: {formatTime(fallbackSlot.startTime)}{fallbackSlot.staffName ? ` (${fallbackSlot.staffName})` : ''}</>}
                    </div>
                    {fallbackSlot && (
                      <button
                        onClick={() => {
                          if (fallbackSlot.staffId) {
                            setSelectedStaff(
                              staffMembers.find((s) => s.id === fallbackSlot.staffId) || {
                                id: fallbackSlot.staffId,
                                name: fallbackSlot.staffName || 'Mitarbeiter',
                                imageUrl: fallbackSlot.staffImageUrl ?? null,
                              }
                            )
                          }
                          setSelectedSlot(fallbackSlot)
                          setStep(5)
                        }}
                        className="mt-2 text-sm font-medium text-amber-900 underline"
                      >
                        Termin übernehmen
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.filter((s) => s.available).map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedSlot(slot); setStep(5) }}
                      className={`p-2 rounded-lg text-sm font-medium transition-all ${
                        selectedSlot?.startTime === slot.startTime
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900'
                      }`}
                    >
                      {formatTime(slot.startTime)}
                    </button>
                  ))}
                  {!closedReason && availableSlots.filter((s) => s.available).length === 0 && (
                    <div className="col-span-full text-center py-4 text-gray-500">
                      Keine freien Termine für dieses Datum
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 5: Customer Details */}
        {step === 5 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <button onClick={() => setStep(4)} className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700">
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">5. Ihre Daten</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Name *</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Max Mustermann" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">E-Mail *</label>
                <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="max@example.de" required />
              </div>
              <PublicBookingSubmissionError error={submissionError} />
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Telefon {requiredFields.phone ? '*' : '(optional)'}
                </label>
                <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+49 123 456789" required={requiredFields.phone} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Anmerkungen {requiredFields.notes ? '*' : '(optional)'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Besondere Wünsche..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  rows={3}
                  required={requiredFields.notes}
                />
              </div>
              <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="font-medium mb-2 dark:text-white">Zusammenfassung</h3>
                <div className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                  <p><span className="font-medium">Standort:</span> {selectedLocation?.name}</p>
                  <div className="space-y-2">
                    {cartItems.map((item, idx) => (
                      <div key={item.uid} className="rounded-lg bg-white p-3 ring-1 ring-gray-200 dark:bg-slate-800 dark:ring-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {cartItems.length > 1 && <span className="text-gray-400">Person {idx + 1}: </span>}
                            {item.offering.name}
                          </span>
                          {showPrice && <span className="text-gray-500">{formatPrice(itemPriceCents(item))}</span>}
                        </div>
                        {item.addons.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            + {item.addons.map((a) => a.name).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {isMultiPerson ? (
                    <p className="text-gray-500 dark:text-gray-400">
                      <User className="mr-1 inline h-4 w-4" />
                      Mitarbeiter werden automatisch zugewiesen
                    </p>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-gray-200 dark:bg-slate-800 dark:ring-slate-600">
                      <ResourceAvatar
                        name={selectedBookingStaff?.name || 'Keine Präferenz'}
                        imageUrl={selectedBookingStaff?.imageUrl}
                        className="h-12 w-12"
                      />
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Mitarbeiter
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {selectedBookingStaff?.name || 'Keine Präferenz'}
                        </div>
                      </div>
                    </div>
                  )}
                  <p><span className="font-medium">Datum:</span> {selectedDate.toLocaleDateString('de-DE')}</p>
                  <p><span className="font-medium">Uhrzeit:</span> {selectedSlot && formatTime(selectedSlot.startTime)}</p>
                  {showPrice && (
                    <p className="text-base font-semibold text-gray-900 dark:text-white">
                      <span>Gesamt:</span> {formatPrice(cartTotalCents)}
                    </p>
                  )}
                </div>
              </div>
              <PublicBookingPrivacyNotice
                checked={privacyNoticeAccepted}
                onCheckedChange={setPrivacyNoticeAccepted}
                privacyUrl={getPrivacyPolicyUrl(org?.settings)}
              />
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !customerName ||
                  !customerEmail ||
                  !privacyNoticeAccepted ||
                  (requiredFields.phone && !customerPhone.trim()) ||
                  (requiredFields.notes && !notes.trim())
                }
                className="w-full"
              >
                {submitting ? 'Wird gebucht...' : 'Termin buchen'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Success */}
        {step === 6 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">
              {demoSubmission ? 'Demo abgeschlossen!' : 'Buchung erfolgreich!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {demoSubmission
                ? 'So sieht der letzte Schritt für Kunden aus. In dieser Demo wurde kein echter Termin gespeichert.'
                : 'Vielen Dank für Ihre Buchung. Sie erhalten in Kürze eine Bestätigung per E-Mail.'}
            </p>
            {manageUrl && (
              <div className="mb-6 rounded-lg border border-gray-200 dark:border-slate-700 p-4 text-sm">
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Falls Sie den Termin absagen müssen, nutzen Sie diesen Link:
                </p>
                <a href={manageUrl} className="text-blue-600 dark:text-blue-400 font-medium underline break-all">
                  Termin verwalten / stornieren
                </a>
              </div>
            )}
            <Button onClick={() => window.location.reload()}>
              {demoSubmission ? 'Demo neu starten' : 'Neuen Termin buchen'}
            </Button>
          </div>
        )}
        <PublicBookingFooter privacyUrl={getPrivacyPolicyUrl(org?.settings)} />
      </div>

      {/* Sticky cart bar (service selection step) */}
      {step === 2 && cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
                  {cartItems.length}
                </span>
              </div>
              {showPrice && (
                <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(cartTotalCents)}</span>
              )}
            </div>
            <Button onClick={proceedFromCart} className="flex items-center gap-2">
              Zur Buchung
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
