'use client'

import React, { useState } from 'react'
import { StaffSelector } from '@/components/StaffSelector'
import { StaffDashboard } from '@/components/StaffDashboard'
import { StaffCalendarView } from '@/components/StaffCalendarView'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format, parse } from 'date-fns'

interface AvailabilitySlot {
  startTime: string
  endTime: string
  available: boolean
}

interface StaffBookingInterfaceProps {
  locationId: string
  offeringId: string
  organizationId: string
}

/**
 * StaffBookingInterface Component
 * Complete booking interface with staff management, dashboard, and calendar
 */
export function StaffBookingInterface({
  locationId,
  offeringId,
  organizationId,
}: StaffBookingInterfaceProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [aggregated, setAggregated] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [bookingFormData, setBookingFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: '',
  })
  const [bookingLoading, setBookingLoading] = useState(false)

  const handleSlotSelect = (slot: AvailabilitySlot, staffId: string) => {
    setSelectedSlot(slot)
    // Optionally fetch staff name if needed
    const startTime = new Date(slot.startTime)
    console.log(`Selected slot: ${format(startTime, 'HH:mm')} for staff ${staffId}`)
  }

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSlot) {
      toast.error('Bitte wähle einen Zeitschlitz')
      return
    }

    if (!bookingFormData.customerName || !bookingFormData.customerEmail) {
      toast.error('Bitte fülle alle erforderlichen Felder aus')
      return
    }

    try {
      setBookingLoading(true)

      const response = await fetch('/api/bookings/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          locationId,
          offeringId,
          resourceId: selectedStaffId || undefined,
          customerName: bookingFormData.customerName,
          customerEmail: bookingFormData.customerEmail,
          customerPhone: bookingFormData.customerPhone || undefined,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          notes: bookingFormData.notes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Buchung fehlgeschlagen')
      }

      const booking = await response.json()
      toast.success('Buchung erfolgreich erstellt!')

      // Reset form
      setBookingFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        notes: '',
      })
      setSelectedSlot(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten'
      toast.error(message)
    } finally {
      setBookingLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Multi-Mitarbeiter Buchungssystem
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mt-2">
          Verwalte Buchungen über alle Mitarbeiter oder wähle einen spezifischen Mitarbeiter
        </p>
      </div>

      {/* Staff Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Mitarbeiter auswählen
        </h2>
        <StaffSelector
          locationId={locationId}
          selectedStaffId={selectedStaffId}
          onStaffSelect={setSelectedStaffId}
          showAggregated
          onAggregatedToggle={setAggregated}
          aggregated={aggregated}
        />
      </div>

      {/* Aggregated Dashboard or Calendar View */}
      {aggregated ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📊 Gesamt-Verfügbarkeit
          </h2>
          <StaffDashboard
            locationId={locationId}
            offeringId={offeringId}
            date={selectedDate}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📅 Verfügbarkeitkalender
            </h2>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 block">
                Datum auswählen
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <StaffCalendarView
            locationId={locationId}
            offeringId={offeringId}
            selectedStaffId={selectedStaffId}
            date={selectedDate}
            onSlotSelect={handleSlotSelect}
          />
        </div>
      )}

      {/* Booking Form */}
      {selectedSlot && !aggregated && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ✓ Zeitschlitz ausgewählt
          </h2>

          <div className="mb-6 p-4 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 dark:text-slate-400">Startzeit</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(new Date(selectedSlot.startTime), 'HH:mm')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-slate-400">Endzeit</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(new Date(selectedSlot.endTime), 'HH:mm')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-slate-400">Datum</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(new Date(selectedDate), 'dd.MM.yyyy')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-slate-400">Mitarbeiter</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedStaffName || 'Nicht zugeordnet'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleBookingSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Name *
              </label>
              <Input
                type="text"
                placeholder="Max Mustermann"
                value={bookingFormData.customerName}
                onChange={(e) =>
                  setBookingFormData({
                    ...bookingFormData,
                    customerName: e.target.value,
                  })
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                E-Mail *
              </label>
              <Input
                type="email"
                placeholder="max@example.com"
                value={bookingFormData.customerEmail}
                onChange={(e) =>
                  setBookingFormData({
                    ...bookingFormData,
                    customerEmail: e.target.value,
                  })
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Telefon
              </label>
              <Input
                type="tel"
                placeholder="+49 123 456789"
                value={bookingFormData.customerPhone}
                onChange={(e) =>
                  setBookingFormData({
                    ...bookingFormData,
                    customerPhone: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Notizen
              </label>
              <textarea
                placeholder="Weitere Informationen..."
                value={bookingFormData.notes}
                onChange={(e) =>
                  setBookingFormData({
                    ...bookingFormData,
                    notes: e.target.value,
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={bookingLoading}
                className="flex-1"
              >
                {bookingLoading ? 'Wird gebucht...' : 'Buchung bestätigen'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedSlot(null)}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
