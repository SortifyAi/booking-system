'use client'

import React, { useState, useEffect } from 'react'
import { format, parse, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { de } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { toast } from 'sonner'

interface AvailabilitySlot {
  startTime: string
  endTime: string
  available: boolean
}

interface StaffAvailability {
  staffId: string
  staffName: string
  slots: AvailabilitySlot[]
  utilizationRate: number
  availableSlots: number
  totalSlots: number
}

interface StaffCalendarViewProps {
  locationId: string
  offeringId: string
  selectedStaffId?: string | null
  date?: string
  onSlotSelect?: (slot: AvailabilitySlot, staffId: string) => void
}

/**
 * StaffCalendarView Component
 * Displays availability calendar for selected staff or aggregated view
 */
export function StaffCalendarView({
  locationId,
  offeringId,
  selectedStaffId = null,
  date = format(new Date(), 'yyyy-MM-dd'),
  onSlotSelect,
}: StaffCalendarViewProps) {
  const [staffAvailabilities, setStaffAvailabilities] = useState<StaffAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayDate, setDisplayDate] = useState(date)

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          locationId,
          offeringId,
          date: displayDate,
          ...(selectedStaffId && { staffId: selectedStaffId }),
        })

        const response = await fetch(
          `/api/availability/enhanced?${params.toString()}`,
          { method: 'GET' }
        )

        if (!response.ok) {
          throw new Error('Verfügbarkeitsdaten konnten nicht geladen werden')
        }

        const data = await response.json()

        if (selectedStaffId && data.type === 'individual') {
          setStaffAvailabilities([data.staffMember])
        } else {
          setStaffAvailabilities(data.staffAvailabilities || [])
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    if (locationId && offeringId) {
      fetchAvailability()
    }
  }, [locationId, offeringId, displayDate, selectedStaffId])

  const getSlotsByTime = () => {
    const slotMap = new Map<string, Array<{ staffId: string; available: boolean }>>()

    staffAvailabilities.forEach((staff) => {
      staff.slots.forEach((slot) => {
        if (!slotMap.has(slot.startTime)) {
          slotMap.set(slot.startTime, [])
        }
        slotMap.get(slot.startTime)!.push({
          staffId: staff.staffId,
          available: slot.available,
        })
      })
    })

    return slotMap
  }

  const getUniqueTimeSlots = () => {
    const times = new Set<string>()
    staffAvailabilities.forEach((staff) => {
      staff.slots.forEach((slot) => {
        times.add(slot.startTime)
      })
    })
    return Array.from(times).sort()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm text-center py-4">
        {error}
      </div>
    )
  }

  if (staffAvailabilities.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        Keine Mitarbeiter mit Verfügbarkeit gefunden
      </div>
    )
  }

  const timeSlots = getUniqueTimeSlots()
  const slotMap = getSlotsByTime()

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          onClick={() => setDisplayDate(format(addDays(parse(displayDate, 'yyyy-MM-dd', new Date()), -1), 'yyyy-MM-dd'))}
          size="sm"
        >
          ← Vorige
        </Button>

        <span className="text-sm font-semibold">
          {format(parse(displayDate, 'yyyy-MM-dd', new Date()), 'EEEE, d. MMMM yyyy', {
            locale: de,
          })}
        </span>

        <Button
          variant="outline"
          onClick={() => setDisplayDate(format(addDays(parse(displayDate, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM-dd'))}
          size="sm"
        >
          Nächste →
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left font-semibold text-gray-700 dark:text-slate-300 border-b">
                Uhrzeit
              </th>
              {staffAvailabilities.map((staff) => (
                <th
                  key={staff.staffId}
                  className="p-2 text-center font-semibold text-gray-700 dark:text-slate-300 border-b"
                >
                  <div>{staff.staffName}</div>
                  <div className="text-xs font-normal text-gray-500 dark:text-slate-400">
                    {Math.round(staff.utilizationRate)}% Auslastung
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((timeSlot) => {
              const slotAvailability = slotMap.get(timeSlot) || []
              const startTime = parse(timeSlot, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date())
              const displayTime = format(startTime, 'HH:mm')

              return (
                <tr key={timeSlot} className="border-b hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="p-2 font-medium text-gray-700 dark:text-slate-300">
                    {displayTime}
                  </td>
                  {staffAvailabilities.map((staff) => {
                    const availability = slotAvailability.find(
                      (s) => s.staffId === staff.staffId
                    )

                    return (
                      <td
                        key={`${timeSlot}-${staff.staffId}`}
                        className="p-2 text-center"
                      >
                        {availability ? (
                          <button
                            onClick={() => {
                              const slotObj = staff.slots.find(
                                (s) => s.startTime === timeSlot
                              )
                              if (slotObj && onSlotSelect) {
                                onSlotSelect(slotObj, staff.staffId)
                              }
                            }}
                            className={`w-full py-2 rounded text-xs font-semibold transition-all ${
                              availability.available
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 cursor-pointer'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 cursor-not-allowed opacity-50'
                            }`}
                            disabled={!availability.available}
                          >
                            {availability.available ? '✓ Frei' : '✗ Gebucht'}
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-600 text-xs">
                            -
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>

        {timeSlots.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Keine Zeitschlitze verfügbar
          </div>
        )}
      </div>

      {/* Utilization Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {staffAvailabilities.map((staff) => (
          <div
            key={staff.staffId}
            className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
          >
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 truncate">
              {staff.staffName}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white my-1">
              {staff.availableSlots}
            </p>
            <p className="text-xs text-gray-600 dark:text-slate-400">
              von {staff.totalSlots} Slots frei
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
