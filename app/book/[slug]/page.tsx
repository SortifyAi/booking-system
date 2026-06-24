'use client'

import { use, useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResourceAvatar } from '@/components/ResourceAvatar'
import { PublicBookingFooter, PublicBookingPrivacyNotice } from '@/components/PublicBookingLegal'
import { toast } from 'sonner'
import { Calendar, Clock, User, MapPin, ChevronLeft, ChevronRight, ChevronUp, Check, AlertCircle, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react'
import { combineStaffAvailabilitySlots } from '@/lib/public-booking'
import {
  BOOKING_IN_PAST_ERROR,
  getShowPrices,
  getShowDuration,
  getRequiredCustomerFields,
  getPrivacyPolicyUrl,
  isFutureBookingStart,
  withPastSlotsUnavailable,
} from '@/lib/booking-policy'
import { getDemoStaffMembers, isDemoLocationId } from '@/lib/public-demo'
import { DEFAULT_TIMEZONE, formatTimeInTimeZone } from '@/lib/timezone'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  PublicBookingSubmissionError,
  type BookingSubmissionError,
} from '@/components/PublicBookingSubmissionError'
import { AvailabilityDatePicker, type DayInfo } from '@/components/AvailabilityDatePicker'
import { standaloneOfferings } from '@/lib/offering-order.mjs'

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
  is_standalone_bookable?: boolean
  sort_order?: number
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

const shellClass =
  'min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-100 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white'
const centeredShellClass = `${shellClass} flex items-center justify-center`
const wizardCardClass =
  'rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/90 sm:p-6'
const backButtonClass =
  'mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
const selectionCardBaseClass =
  'w-full rounded-2xl border p-4 text-left transition-all duration-200'
const selectionCardIdleClass =
  'border-slate-200 bg-white/80 hover:border-blue-300 hover:bg-white hover:shadow-md hover:shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500/70 dark:hover:bg-slate-900'
const selectionCardActiveClass =
  'border-blue-500 bg-blue-50/70 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.28)] dark:border-blue-400/80 dark:bg-blue-950/30'

// Add-on (Zusatzleistung) selector for a single cart line. Used both inline in
// the service list and in the cart summary, so the picker behaves identically
// wherever the customer adds extras.
function AddonChips({
  item,
  addonOfferings,
  showPrice,
  formatPrice,
  onToggle,
}: {
  item: CartItem
  addonOfferings: Offering[]
  showPrice: boolean
  formatPrice: (cents: number) => string
  onToggle: (uid: string, addon: Offering) => void
}) {
  const available = addonOfferings.filter((a) => a.id !== item.offering.id)
  if (available.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((addon) => {
        const active = item.addons.some((a) => a.id === addon.id)
        return (
          <button
            key={addon.id}
            type="button"
            onClick={() => onToggle(item.uid, addon)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              active
                ? 'border-blue-600 bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-600/20'
                : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-950/30'
            }`}
          >
            {active ? '✓ ' : '+ '}
            {addon.name}
            {showPrice && addon.price_cents ? ` (${formatPrice(addon.price_cents)})` : ''}
          </button>
        )
      })}
    </div>
  )
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
  // Day-level availability (for the calendar/strip) and the next free day, so
  // customers can jump straight to an open day instead of stepping day-by-day.
  const [dayInfo, setDayInfo] = useState<Record<string, DayInfo>>({})
  const [daysLoading, setDaysLoading] = useState(false)
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null)
  const loadedRangesRef = useRef<Set<string>>(new Set())
  const lastNextFromRef = useRef<string | null>(null)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const [fallbackSlot, setFallbackSlot] = useState<TimeSlot | null>(null)
  const [closedReason, setClosedReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [manageUrl, setManageUrl] = useState<string | null>(null)
  const [demoSubmission, setDemoSubmission] = useState(false)
  const [submissionError, setSubmissionError] = useState<BookingSubmissionError | null>(null)
  const [cartExpanded, setCartExpanded] = useState(false)

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
  const standaloneServiceOfferings = standaloneOfferings(offerings) as Offering[]

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

  // Identifies what the day-level availability depends on (location, the booked
  // durations, and the preferred staff). When it changes the cached day map is
  // stale and must be thrown away.
  const dayScopeKey = useMemo(() => {
    if (!selectedLocation || cartItems.length === 0) return ''
    if (isMultiPerson) {
      return `${selectedLocation.id}|multi|${cartItems.map(itemDuration).join(',')}`
    }
    return `${selectedLocation.id}|single|${itemDuration(cartItems[0])}|${selectedStaff?.id || 'any'}`
  }, [selectedLocation, cartItems, selectedStaff, isMultiPerson])

  useEffect(() => {
    setDayInfo({})
    setNextAvailableDate(null)
    loadedRangesRef.current = new Set()
    lastNextFromRef.current = null
  }, [dayScopeKey])

  function buildDayParams(fromStr: string, toStr: string): URLSearchParams | null {
    if (!selectedLocation || cartItems.length === 0) return null
    const params = new URLSearchParams({ locationId: selectedLocation.id, from: fromStr, to: toStr })
    if (isMultiPerson) {
      params.set('durations', cartItems.map(itemDuration).join(','))
    } else {
      params.set('duration', String(itemDuration(cartItems[0])))
      params.set('offeringId', cartItems[0].offering.id)
      if (selectedStaff) params.set('preferredStaffId', selectedStaff.id)
    }
    return params
  }

  function mergeDays(days?: Array<{ date: string; available: boolean; closed: boolean }>) {
    if (!days || days.length === 0) return
    setDayInfo((prev) => {
      const next = { ...prev }
      for (const d of days) next[d.date] = { available: d.available, closed: d.closed }
      return next
    })
  }

  // Loads per-day availability for [from, to] (the calendar/strip shading).
  // Deduplicated per visible range within the current scope.
  async function loadDayAvailability(fromStr: string, toStr: string) {
    const sig = `${fromStr}_${toStr}`
    if (loadedRangesRef.current.has(sig)) return
    loadedRangesRef.current.add(sig)
    const params = buildDayParams(fromStr, toStr)
    if (!params) return
    setDaysLoading(true)
    try {
      const res = await fetch(`/api/availability/range?${params}`)
      const data = await res.json()
      mergeDays(data.days)
    } catch {
      loadedRangesRef.current.delete(sig)
    } finally {
      setDaysLoading(false)
    }
  }

  // Finds the next free day from `fromStr` (looks up to ~3 months ahead). Used to
  // surface "next available appointment" when the chosen day has no open slots.
  async function loadNextAvailableFrom(fromStr: string) {
    if (lastNextFromRef.current === fromStr) return
    lastNextFromRef.current = fromStr
    const toStr = format(new Date(new Date(fromStr).getTime() + 41 * 86400000), 'yyyy-MM-dd')
    const params = buildDayParams(fromStr, toStr)
    if (!params) return
    try {
      const res = await fetch(`/api/availability/range?${params}`)
      const data = await res.json()
      mergeDays(data.days)
      setNextAvailableDate(data.nextAvailableDate ?? null)
    } catch {
      lastNextFromRef.current = null
    }
  }

  // When the selected day is open but has no free slots (e.g. staff on holiday),
  // look up the next free day so the customer can jump there in one tap.
  useEffect(() => {
    if (step !== 4 || loading) return
    const hasSlots = availableSlots.some((s) => s.available)
    if (hasSlots || closedReason) {
      setNextAvailableDate(null)
      return
    }
    loadNextAvailableFrom(format(selectedDate, 'yyyy-MM-dd'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSlots, loading, closedReason, step, selectedDate])

  function addToCart(offering: Offering) {
    setCartItems((prev) => [...prev, { uid: makeUid(), offering, addons: [] }])
  }

  function removeFromCart(uid: string) {
    setCartItems((prev) => prev.filter((item) => item.uid !== uid))
  }

  // Remove the most recently added line for an offering (used by the inline
  // quantity stepper), so add-ons picked on earlier lines stay intact.
  function decrementFromCart(offeringId: string) {
    setCartItems((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].offering.id === offeringId) {
          return prev.filter((_, idx) => idx !== i)
        }
      }
      return prev
    })
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
  const availableSlotsForDay = availableSlots.filter((slot) => slot.available)
  const availableSlotCount = availableSlotsForDay.length

  const showPrice = getShowPrices(org?.settings)
  const showDur = getShowDuration(org?.settings)

  if (loading && !org) {
    return (
      <div className={centeredShellClass}>
        <div className="text-slate-500 dark:text-slate-400">Wird geladen...</div>
      </div>
    )
  }

  if (orgNotFound) {
    return (
      <div className={centeredShellClass}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Seite nicht gefunden</h1>
          <p className="text-slate-500 dark:text-slate-400">Diese Buchungsseite existiert nicht.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 sm:py-10">
        <div className="mb-8 text-center sm:mb-10">
          {org?.logo_url ? (
            <img
              src={org.logo_url}
              alt={`${org.name} Logo`}
              className="mx-auto mb-5 h-16 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <h1 className="mb-2 text-3xl font-bold text-slate-950 dark:text-white">
              {org?.name}
            </h1>
          )}
          <p className="text-base font-medium text-slate-600 dark:text-slate-300">
            Termin online buchen
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center sm:mb-10">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-200',
                  step >= s
                    ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-slate-200/80 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                )}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 5 && (
                <div
                  className={cn(
                    'h-0.5 w-12 rounded-full transition-colors sm:w-16',
                    step > s ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Location */}
        {step === 1 && (
          <div className={wizardCardClass}>
            <h2 className="mb-5 text-xl font-bold text-slate-950 dark:text-white">1. Standort auswählen</h2>
            {loading ? (
              <div className="py-8 text-center text-slate-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => { setSelectedLocation(loc); setStep(2) }}
                    className={cn(
                      selectionCardBaseClass,
                      selectedLocation?.id === loc.id ? selectionCardActiveClass : selectionCardIdleClass
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                        <MapPin className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-slate-950 dark:text-white">{loc.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{loc.address}</div>
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
          <div className={wizardCardClass}>
            <button onClick={() => setStep(1)} className={backButtonClass}>
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="mb-1 text-xl font-bold text-slate-950 dark:text-white">2. Leistungen auswählen</h2>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
              Mehrere Leistungen für mehrere Personen? Einfach mehrfach hinzufügen.
            </p>
            {loading ? (
              <div className="py-8 text-center text-slate-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                {standaloneServiceOfferings.map((offering) => {
                  const linesForOffering = cartItems.filter((c) => c.offering.id === offering.id)
                  const inCart = linesForOffering.length
                  const hasMeta = showPrice || showDur
                  const eligibleAddons = addonOfferings.filter((a) => a.id !== offering.id)
                  return (
                    <div
                      key={offering.id}
                      className={cn(
                        'w-full rounded-2xl border p-4 transition-all duration-200',
                        inCart > 0 ? selectionCardActiveClass : selectionCardIdleClass
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          {offering.image_url ? (
                            <img
                              src={offering.image_url}
                              alt={`${offering.name} Bild`}
                              className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="h-3.5 w-3.5 flex-shrink-0 rounded-full ring-4 ring-slate-100 dark:ring-slate-800"
                              style={{ backgroundColor: offering.color }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-950 dark:text-white">
                              {offering.name}
                              {offering.available_as_addon && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                  auch als Zusatz
                                </span>
                              )}
                            </div>
                            {offering.description && (
                              <div className="text-sm text-slate-500 dark:text-slate-400">{offering.description}</div>
                            )}
                            {hasMeta && (
                              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {showPrice && <span className="font-semibold text-slate-700 dark:text-slate-300">{formatPrice(offering.price_cents)}</span>}
                                {showPrice && showDur && ' · '}
                                {showDur && <span>{offering.duration_minutes} Min.</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        {inCart > 0 ? (
                          <div className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-blue-500/80 bg-white/75 p-1 shadow-sm dark:bg-slate-950/25">
                            <button
                              onClick={() => decrementFromCart(offering.id)}
                              aria-label={`${offering.name} entfernen`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 active:scale-95 dark:text-blue-300 dark:hover:bg-blue-900/30"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-7 text-center text-sm font-bold text-blue-700 dark:text-blue-300" aria-live="polite">
                              {inCart}
                            </span>
                            <button
                              onClick={() => addToCart(offering)}
                              aria-label={`${offering.name} hinzufügen`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50 active:scale-95 dark:text-blue-300 dark:hover:bg-blue-900/30"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(offering)}
                            className="h-10 self-end px-3.5 text-sm sm:h-11 sm:px-4 flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 font-bold text-white shadow-sm shadow-blue-600/20 transition hover:to-blue-700 active:scale-[0.98]"
                          >
                            <Plus className="h-4 w-4" />
                            Hinzufügen
                          </button>
                        )}
                      </div>

                      {/* Inline add-ons: the moment a service is in the cart, its
                          optional extras are right here — no need to open the cart. */}
                      {inCart > 0 && eligibleAddons.length > 0 && (
                        <div className="mt-3 border-t border-blue-100 pt-3 dark:border-slate-700/80">
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <Plus className="h-3.5 w-3.5 text-blue-600" />
                            Zusatzleistungen (optional)
                          </div>
                          <div className="space-y-2">
                            {linesForOffering.map((line, i) => (
                              <div key={line.uid}>
                                {inCart > 1 && (
                                  <div className="mb-1 text-[11px] font-semibold text-slate-400">
                                    Person {i + 1}
                                  </div>
                                )}
                                <AddonChips
                                  item={line}
                                  addonOfferings={addonOfferings}
                                  showPrice={showPrice}
                                  formatPrice={formatPrice}
                                  onToggle={toggleAddon}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Staff (single person only) */}
        {step === 3 && (
          <div className={wizardCardClass}>
            <button onClick={() => setStep(2)} className={backButtonClass}>
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="mb-5 text-xl font-bold text-slate-950 dark:text-white">3. Mitarbeiter auswählen</h2>
            {loading ? (
              <div className="py-8 text-center text-slate-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => { setSelectedStaff(null); setLoading(true); setStep(4) }}
                  className={cn(selectionCardBaseClass, selectionCardIdleClass)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                      <User className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-semibold text-slate-950 dark:text-white">Keine Präferenz</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Beliebiger Mitarbeiter</div>
                    </div>
                  </div>
                </button>
                {staffMembers.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => { setSelectedStaff(staff); setLoading(true); setStep(4) }}
                    className={cn(
                      selectionCardBaseClass,
                      'p-3 sm:p-4',
                      selectedStaff?.id === staff.id ? selectionCardActiveClass : selectionCardIdleClass
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ResourceAvatar
                        name={staff.name}
                        imageUrl={staff.imageUrl}
                        className="h-14 w-14"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-950 dark:text-white">{staff.name}</div>
                        <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
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
          <div className={wizardCardClass}>
            <button onClick={() => setStep(isMultiPerson ? 2 : 3)} className={backButtonClass}>
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="mb-5 text-xl font-bold text-slate-950 dark:text-white">4. Datum & Uhrzeit</h2>
            {isMultiPerson && (
              <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-sm font-medium text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                Für {cartItems.length} Personen – es werden nur Zeiten angezeigt, an denen genügend Mitarbeiter gleichzeitig frei sind.
              </p>
            )}
            <div className="mb-4">
              <AvailabilityDatePicker
                selectedDate={selectedDate}
                onSelect={(d) => {
                  setLoading(true)
                  setSelectedSlot(null)
                  setSelectedDate(d)
                }}
                dayInfo={dayInfo}
                onRangeNeeded={loadDayAvailability}
                loading={daysLoading}
              />
            </div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Freie Zeiten
                </h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {loading
                    ? 'Verfügbarkeit wird geprüft'
                    : availableSlotCount === 1 ? '1 Termin verfügbar' : `${availableSlotCount} Termine verfügbar`}
                </p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <Clock className="h-5 w-5" />
              </span>
            </div>
            {loading ? (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : (
              <>
                {closedReason && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="font-semibold text-slate-950 dark:text-white">An diesem Tag geschlossen</div>
                    {closedReason !== 'Geschlossen' && (
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{closedReason}</div>
                    )}
                  </div>
                )}
                {fallbackReason && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-900 shadow-sm">
                    <div className="font-semibold">Hinweis</div>
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
                        className="mt-2 text-sm font-semibold text-amber-900 underline"
                      >
                        Termin übernehmen
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availableSlotsForDay.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedSlot(slot); setStep(5) }}
                      className={cn(
                        'h-12 rounded-xl px-3 text-sm font-bold transition-all duration-200',
                        selectedSlot?.startTime === slot.startTime
                          ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md shadow-blue-600/20'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/70 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'
                      )}
                    >
                      {formatTime(slot.startTime)}
                    </button>
                  ))}
                  {!closedReason && availableSlotCount === 0 && (
                    <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center dark:border-slate-700 dark:bg-slate-800/60">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        Keine freien Termine an diesem Tag
                      </p>
                      {nextAvailableDate && nextAvailableDate !== format(selectedDate, 'yyyy-MM-dd') ? (
                        <button
                          onClick={() => {
                            setLoading(true)
                            setSelectedSlot(null)
                            setSelectedDate(new Date(`${nextAvailableDate}T12:00:00`))
                          }}
                          className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:to-blue-700"
                        >
                          <Calendar className="h-4 w-4" />
                          Nächster freier Termin:{' '}
                          {new Date(`${nextAvailableDate}T12:00:00`).toLocaleDateString('de-DE', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </button>
                      ) : (
                        !nextAvailableDate && (
                          <p className="mt-1 text-sm text-gray-400">
                            Aktuell keine freien Termine in den nächsten Wochen.
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 5: Customer Details */}
        {step === 5 && (
          <div className={wizardCardClass}>
            <button onClick={() => setStep(4)} className={backButtonClass}>
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="mb-5 text-xl font-bold text-slate-950 dark:text-white">5. Ihre Daten</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Name *</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Max Mustermann" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">E-Mail *</label>
                <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="max@example.de" required />
              </div>
              <PublicBookingSubmissionError error={submissionError} />
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Telefon {requiredFields.phone ? '*' : '(optional)'}
                </label>
                <Input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+49 123 456789" required={requiredFields.phone} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Anmerkungen {requiredFields.notes ? '*' : '(optional)'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Besondere Wünsche..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400"
                  rows={3}
                  required={requiredFields.notes}
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <h3 className="mb-3 font-bold text-slate-950 dark:text-white">Zusammenfassung</h3>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p><span className="font-medium">Standort:</span> {selectedLocation?.name}</p>
                  <div className="space-y-2">
                    {cartItems.map((item, idx) => (
                      <div key={item.uid} className="rounded-xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-950 dark:text-white">
                            {cartItems.length > 1 && <span className="text-slate-400">Person {idx + 1}: </span>}
                            {item.offering.name}
                          </span>
                          {showPrice && <span className="text-slate-500">{formatPrice(itemPriceCents(item))}</span>}
                        </div>
                        {item.addons.length > 0 && (
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            + {item.addons.map((a) => a.name).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {isMultiPerson ? (
                    <p className="text-slate-500 dark:text-slate-400">
                      <User className="mr-1 inline h-4 w-4" />
                      Mitarbeiter werden automatisch zugewiesen
                    </p>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-slate-700">
                      <ResourceAvatar
                        name={selectedBookingStaff?.name || 'Keine Präferenz'}
                        imageUrl={selectedBookingStaff?.imageUrl}
                        className="h-12 w-12"
                      />
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Mitarbeiter
                        </div>
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {selectedBookingStaff?.name || 'Keine Präferenz'}
                        </div>
                      </div>
                    </div>
                  )}
                  <p><span className="font-medium">Datum:</span> {selectedDate.toLocaleDateString('de-DE')}</p>
                  <p><span className="font-medium">Uhrzeit:</span> {selectedSlot && formatTime(selectedSlot.startTime)}</p>
                  {showPrice && (
                    <p className="text-base font-bold text-slate-950 dark:text-white">
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
          <div className={`${wizardCardClass} text-center`}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50 dark:bg-green-900/60 dark:ring-green-950/30">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-950 dark:text-white">
              {demoSubmission ? 'Demo abgeschlossen!' : 'Buchung erfolgreich!'}
            </h2>
            <p className="mb-6 text-slate-600 dark:text-slate-300">
              {demoSubmission
                ? 'So sieht der letzte Schritt für Kunden aus. In dieser Demo wurde kein echter Termin gespeichert.'
                : 'Vielen Dank für Ihre Buchung. Sie erhalten in Kürze eine Bestätigung per E-Mail.'}
            </p>
            {manageUrl && (
              <div className="mb-6 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                <p className="mb-2 text-slate-600 dark:text-slate-300">
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
        <>
          {/* Backdrop when expanded (mobile-friendly tap-to-close) */}
          {cartExpanded && (
            <div
              className="fixed inset-0 z-20 bg-slate-950/45 backdrop-blur-[1px]"
              onClick={() => setCartExpanded(false)}
              aria-hidden="true"
            />
          )}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 shadow-[0_-18px_50px_-28px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/90">
            {/* Expandable cart contents */}
            {cartExpanded && (
              <div className="border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
                <div className="mx-auto max-w-3xl sm:px-2">
                  <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
                    <ShoppingCart className="h-5 w-5 text-blue-600" /> Ihre Auswahl
                  </h3>
                  <div className="max-h-[46vh] space-y-2 overflow-y-auto pb-1">
                    {cartItems.map((item, idx) => (
                      <div key={item.uid} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/95 p-3 dark:border-slate-700/80 dark:bg-slate-900/85">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-950 dark:text-white">
                              {cartItems.length > 1 && <span className="text-slate-400">{idx + 1}. </span>}
                              {item.offering.name}
                            </div>
                            {showPrice && (
                              <div className="text-sm text-slate-500 dark:text-slate-400">{formatPrice(itemPriceCents(item))}</div>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.uid)}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                            title="Entfernen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Add-ons for this line */}
                        {addonOfferings.filter((a) => a.id !== item.offering.id).length > 0 && (
                          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                            <div className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Zusatzleistungen (optional)
                            </div>
                            <AddonChips
                              item={item}
                              addonOfferings={addonOfferings}
                              showPrice={showPrice}
                              formatPrice={formatPrice}
                              onToggle={toggleAddon}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bar */}
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
              <button
                type="button"
                onClick={() => setCartExpanded((v) => !v)}
                className="flex min-w-0 items-center gap-2 rounded-xl py-1 pr-1 text-left transition hover:opacity-85 sm:gap-3 sm:pr-2"
                aria-expanded={cartExpanded}
                aria-label={cartExpanded ? 'Auswahl ausblenden' : 'Auswahl anzeigen'}
              >
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 sm:h-11 sm:w-11 sm:rounded-2xl">
                  <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white shadow-sm">
                    {cartItems.length}
                  </span>
                </div>
                {showPrice && (
                  <span className="text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">{formatPrice(cartTotalCents)}</span>
                )}
                <ChevronUp
                  className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${cartExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              <Button onClick={proceedFromCart} className="h-11 min-w-[132px] px-4 text-sm sm:h-12 sm:min-w-[150px] sm:text-base flex items-center gap-1.5 sm:gap-2">
                Zur Buchung
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
