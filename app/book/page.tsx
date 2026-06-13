'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResourceAvatar } from '@/components/ResourceAvatar'
import { PublicBookingFooter, PublicBookingPrivacyNotice } from '@/components/PublicBookingLegal'
import { toast } from 'sonner'
import { Calendar, Clock, User, Scissors, MapPin, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { combineStaffAvailabilitySlots } from '@/lib/public-booking'
import { format } from 'date-fns'

interface Location {
  id: string
  name: string
  address: string
}

interface Offering {
  id: string
  name: string
  description: string
  duration_minutes: number
  price_cents: number
  color: string
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

export default function BookPage() {
  const supabase = createClient()
  
  const [step, setStep] = useState(1)
  const [locations, setLocations] = useState<Location[]>([])
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const [fallbackSlot, setFallbackSlot] = useState<TimeSlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form data
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false)

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations()
  }, [])

  // Fetch offerings when location is selected
  useEffect(() => {
    if (selectedLocation) {
      setSelectedOffering(null)
      setStaffMembers([])
      setSelectedStaff(null)
      setAvailableSlots([])
      setSelectedSlot(null)
      setFallbackReason(null)
      setFallbackSlot(null)
      fetchOfferings(selectedLocation.id)
    }
  }, [selectedLocation])

  // Fetch staff when offering is selected
  useEffect(() => {
    if (selectedOffering && selectedLocation) {
      setSelectedStaff(null)
      setAvailableSlots([])
      setSelectedSlot(null)
      setFallbackReason(null)
      setFallbackSlot(null)
      fetchStaffMembers(selectedLocation.id, selectedOffering.id)
    }
  }, [selectedOffering, selectedLocation])

  // Fetch availability when date/offering/staff changes
  useEffect(() => {
    if (selectedOffering && selectedLocation && selectedDate) {
      fetchAvailability()
    }
  }, [selectedOffering, selectedLocation, selectedDate, selectedStaff])

  async function fetchLocations() {
    setLoading(true)
    try {
      // Use API endpoint for mock mode support
      const response = await fetch('/api/locations')
      const result = await response.json()
      
      if (!response.ok || result.error) throw new Error(result.error || 'Failed to fetch')
      const fetchedLocations = result.data || []
      setLocations(fetchedLocations)
      
      // Auto-select location if only one exists
      if (fetchedLocations.length === 1) {
        setSelectedLocation(fetchedLocations[0])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      // Fallback to mock data if API fails
      setLocations([
        { id: '1', name: 'Demo Friseursalon', address: 'Hauptstraße 1, Berlin' }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function fetchOfferings(locationId: string) {
    setLoading(true)
    try {
      // Use API endpoint instead of direct Supabase client for mock mode support
      const response = await fetch(`/api/public/offerings?location_id=${locationId}`)
      const result = await response.json()
      
      if (!response.ok || result.error) throw new Error(result.error || 'Failed to fetch')
      setOfferings(result.offerings || [])
    } catch (error) {
      console.error('Error fetching offerings:', error)
      // Fallback
      setOfferings([
        { id: '1', name: 'Haarschnitt', description: 'Waschen, Schneiden, Föhnen', duration_minutes: 45, price_cents: 3500, color: '#3b82f6' },
        { id: '2', name: 'Färben', description: 'Professionelle Coloration', duration_minutes: 120, price_cents: 7500, color: '#8b5cf6' },
        { id: '3', name: 'Styling', description: 'Professionelles Styling', duration_minutes: 30, price_cents: 2500, color: '#ec4899' }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function fetchStaffMembers(locationId: string, offeringId: string) {
    setLoading(true)
    try {
      // Use mock data directly in mock mode
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
        setLoading(false)
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
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

      setStaffMembers(mapped)
    } catch (error) {
      console.error('Error fetching staff members:', error)
      // Fallback mock staff data
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
    } finally {
      setLoading(false)
    }
  }

  async function fetchAvailability() {
    setLoading(true)
    setFallbackReason(null)
    setFallbackSlot(null)
    try {
      // Local calendar date (NOT toISOString, which is UTC and shifts the day
      // late in the evening for Europe/Berlin → wrong/missing slots).
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      if (selectedStaff) {
        const params = new URLSearchParams({
          locationId: selectedLocation!.id,
          offeringId: selectedOffering!.id,
          date: dateStr,
          mode: 'smart',
          preferredStaffId: selectedStaff.id,
        })
        const response = await fetch(`/api/availability/enhanced?${params.toString()}`)
        const data = await response.json()

        if (data.type === 'smart') {
          const slots = (data.preferredStaffAvailableSlots || []).map((slot: TimeSlot) => ({
            ...slot,
            available: true,
            staffId: selectedStaff.id,
            staffName: selectedStaff.name,
            staffImageUrl: selectedStaff.imageUrl ?? null,
          }))
          setAvailableSlots(slots)

          if (data.fallbackNextAvailable) {
            setFallbackReason(data.reason || 'Bevorzugter Mitarbeiter ist nicht verfügbar')
            setFallbackSlot({
              ...data.fallbackNextAvailable,
              available: true,
              staffId: data.fallbackNextAvailable.staffId,
              staffName: data.fallbackNextAvailable.staffName,
              staffImageUrl: data.fallbackNextAvailable.staffImageUrl ?? null,
            })
          }
        }
      } else {
        const params = new URLSearchParams({
          locationId: selectedLocation!.id,
          offeringId: selectedOffering!.id,
          date: dateStr,
          aggregated: 'true',
        })
        const response = await fetch(`/api/availability/enhanced?${params.toString()}`)
        const data = await response.json()

        if (data.type === 'aggregated' && data.staffDetails) {
          setAvailableSlots(combineStaffAvailabilitySlots(data.staffDetails))
        } else if (data.slots) {
          setAvailableSlots(data.slots)
        } else {
          setAvailableSlots([])
        }
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!selectedLocation || !selectedOffering || !selectedSlot || !customerName || !customerEmail) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }
    if (!privacyNoticeAccepted) {
      toast.error('Bitte bestätigen Sie die Datenschutzinformationen')
      return
    }

    setSubmitting(true)
    try {
      const resourceId = selectedSlot.staffId || selectedStaff?.id
      const bookingData = {
        locationId: selectedLocation.id,
        offeringId: selectedOffering.id,
        resourceId: resourceId || undefined,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone || undefined,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        notes: notes || undefined,
        privacyNoticeAccepted,
      }
      
      // Use enhanced API endpoint which handles organization_id lookup and staff validation
      const response = await fetch('/api/bookings/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      })
      
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Booking failed')

      toast.success('Buchung erfolgreich! Wir bestätigen per E-Mail.')
      setStep(6) // Success step
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error('Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  // Week days for calendar
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const today = new Date()
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
  const weekStart = new Date(selectedDate)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Termin buchen
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Wählen Sie einen Termin für Ihren Besuch
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}
              `}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 5 && (
                <div className={`w-12 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Location Selection */}
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

        {/* Step 2: Service Selection */}
        {step === 2 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <button 
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">2. Leistung auswählen</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                {offerings.map((offering) => (
                  <button
                    key={offering.id}
                    onClick={() => { setSelectedOffering(offering); setStep(3) }}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:border-blue-500 ${
                      selectedOffering?.id === offering.id 
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: offering.color }}
                        />
                        <div>
                          <div className="font-medium dark:text-white">{offering.name}</div>
                          <div className="text-sm text-gray-500">{offering.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold dark:text-white">{formatPrice(offering.price_cents)}</div>
                        <div className="text-sm text-gray-500">{offering.duration_minutes} Min.</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Staff Selection */}
        {step === 3 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <button 
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">3. Mitarbeiter auswählen</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => { setSelectedStaff(null); setStep(4) }}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:border-blue-500 ${
                    selectedStaff === null
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium dark:text-white">Keine Präferenz</div>
                      <div className="text-sm text-gray-500">Beliebiger Mitarbeiter</div>
                    </div>
                  </div>
                </button>
                {staffMembers.length === 0 && (
                  <div className="text-sm text-gray-500">
                    Keine Mitarbeiter für diese Leistung verfügbar.
                  </div>
                )}
                {staffMembers.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => { setSelectedStaff(staff); setStep(4) }}
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

        {/* Step 4: Date & Time Selection */}
        {step === 4 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <button 
              onClick={() => setStep(3)}
              className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">4. Datum & Uhrzeit</h2>
            
            {/* Simple Date Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={() => {
                  const newDate = new Date(selectedDate)
                  newDate.setDate(newDate.getDate() - 1)
                  if (newDate >= today) setSelectedDate(newDate)
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
                  const newDate = new Date(selectedDate)
                  newDate.setDate(newDate.getDate() + 1)
                  setSelectedDate(newDate)
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ChevronRight className="w-5 h-5 dark:text-white" />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Verfügbarkeit wird geladen...</div>
            ) : (
              <>
                {fallbackReason && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-medium">Hinweis</div>
                    <div>
                      {fallbackReason}
                      {fallbackSlot && (
                        <>
                          {' '}Nächster Termin: {formatTime(fallbackSlot.startTime)}
                          {fallbackSlot.staffName ? ` (${fallbackSlot.staffName})` : ''}
                        </>
                      )}
                    </div>
                    {fallbackSlot && (
                      <button
                        onClick={() => {
                          if (fallbackSlot.staffId) {
                            const fallbackStaff = staffMembers.find(s => s.id === fallbackSlot.staffId) || {
                              id: fallbackSlot.staffId,
                              name: fallbackSlot.staffName || 'Mitarbeiter',
                              imageUrl: fallbackSlot.staffImageUrl ?? null,
                            }
                            setSelectedStaff(fallbackStaff)
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
                  {availableSlots
                    .filter(slot => slot.available)
                    .map((slot, idx) => (
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
                  {availableSlots.filter(s => s.available).length === 0 && (
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
            <button 
              onClick={() => setStep(4)}
              className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" /> Zurück
            </button>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">5. Ihre Daten</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Name *
                </label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Max Mustermann"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  E-Mail *
                </label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="max@example.de"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Telefon (optional)
                </label>
                <Input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+49 123 456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Anmerkungen (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Besondere Wünsche..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  rows={3}
                />
              </div>

              {/* Booking Summary */}
              <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 mt-4">
                <h3 className="font-medium mb-2 dark:text-white">Zusammenfassung</h3>
                <div className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                  <p><span className="font-medium">Standort:</span> {selectedLocation?.name}</p>
                  <p><span className="font-medium">Leistung:</span> {selectedOffering?.name}</p>
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
                  <p><span className="font-medium">Datum:</span> {selectedDate.toLocaleDateString('de-DE')}</p>
                  <p><span className="font-medium">Uhrzeit:</span> {selectedSlot && formatTime(selectedSlot.startTime)}</p>
                  <p><span className="font-medium">Preis:</span> {selectedOffering && formatPrice(selectedOffering.price_cents)}</p>
                </div>
              </div>
              <PublicBookingPrivacyNotice
                checked={privacyNoticeAccepted}
                onCheckedChange={setPrivacyNoticeAccepted}
              />

              <Button 
                onClick={handleSubmit}
                disabled={submitting || !customerName || !customerEmail || !privacyNoticeAccepted}
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
            <h2 className="text-2xl font-bold mb-2 dark:text-white">Buchung erfolgreich!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Vielen Dank für Ihre Buchung. Sie erhalten in Kürze eine Bestätigung per E-Mail.
            </p>
            <Button onClick={() => window.location.reload()}>
              Neuen Termin buchen
            </Button>
          </div>
        )}
        <PublicBookingFooter />
      </div>
    </div>
  )
}
