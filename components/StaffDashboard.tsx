'use client'

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { StatCard } from '@/components/StatCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { toast } from 'sonner'

export interface StaffDashboardStats {
  totalStaff: number
  availableStaff: number
  peakHours: string[]
  freeSlots: string[]
  overallUtilization: number
  status: 'green' | 'orange' | 'red'
  staffDetails: Array<{
    id: string
    name: string
    utilization: number
    isAvailable: boolean
  }>
}

interface StaffDashboardProps {
  locationId: string
  offeringId: string
  date?: string
}

export function StaffDashboard({
  locationId,
  offeringId,
  date = format(new Date(), 'yyyy-MM-dd'),
}: StaffDashboardProps) {
  const [stats, setStats] = useState<StaffDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAggregatedStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/availability/enhanced?locationId=${locationId}&offeringId=${offeringId}&date=${date}&aggregated=true`,
          { method: 'GET' }
        )

        if (!response.ok) {
          throw new Error('Verfügbarkeitsdaten konnten nicht geladen werden')
        }

        const data = await response.json()
        const aggregated = data.aggregated

        const dashboardStats: StaffDashboardStats = {
          totalStaff: aggregated.totalCapacity,
          availableStaff: aggregated.availableCapacity,
          peakHours: aggregated.peakHours || [],
          freeSlots: aggregated.freeSlots || [],
          overallUtilization: aggregated.utilizationRate || 0,
          status: aggregated.status,
          staffDetails: aggregated.staffSummary.map((s: any) => ({
            id: s.staffId,
            name: s.staffName,
            utilization: s.utilization,
            isAvailable: s.utilization < 100,
          })) || [],
        }

        setStats(dashboardStats)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    if (locationId && offeringId) {
      fetchAggregatedStats()
    }
  }, [locationId, offeringId, date])

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

  if (!stats) {
    return null
  }

  const getStatusColor = () => {
    switch (stats.status) {
      case 'green':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'orange':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'red':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }
  }

  const getStatusText = () => {
    switch (stats.status) {
      case 'green':
        return '✅ Viel Kapazität verfügbar'
      case 'orange':
        return '⚠️ Kapazität teilweise ausgelastet'
      case 'red':
        return '❌ Kapazität fast ausgelastet'
    }
  }

  const getTextColor = () => {
    switch (stats.status) {
      case 'green':
        return 'text-green-900 dark:text-green-100'
      case 'orange':
        return 'text-yellow-900 dark:text-yellow-100'
      case 'red':
        return 'text-red-900 dark:text-red-100'
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className={`border rounded-lg p-6 ${getStatusColor()}`}>
        <p className={`text-lg font-semibold ${getTextColor()}`}>
          {getStatusText()}
        </p>
        <p className="text-sm mt-2 opacity-80">
          Datum: {new Date(date).toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Verfügbare Mitarbeiter"
          value={`${stats.availableStaff}/${stats.totalStaff}`}
          icon="👥"
        />
        <StatCard
          label="Auslastung"
          value={`${Math.round(stats.overallUtilization)}%`}
          icon="📊"
        />
        <StatCard
          label="Freie Slots"
          value={stats.freeSlots.length}
          icon="⏰"
        />
        <StatCard
          label="Peak Hours"
          value={stats.peakHours.length}
          icon="🔥"
        />
      </div>

      {/* Staff Individual Status */}
      {stats.staffDetails.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
            Mitarbeiter-Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.staffDetails.map((staff) => (
              <div
                key={staff.id}
                className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-gray-800 dark:text-slate-200">
                    {staff.name}
                  </p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      staff.utilization < 50
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : staff.utilization < 80
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}
                  >
                    {staff.isAvailable ? 'Verfügbar' : 'Vollausgelastet'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      staff.utilization < 50
                        ? 'bg-green-500'
                        : staff.utilization < 80
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${staff.utilization}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-2">
                  {Math.round(staff.utilization)}% ausgelastet
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peak Hours & Free Slots Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.peakHours.length > 0 && (
          <div className="p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
            <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-2">
              🔥 Stoßzeiten
            </p>
            <ul className="text-xs text-orange-800 dark:text-orange-200 space-y-1">
              {stats.peakHours.map((hour, idx) => (
                <li key={idx}>{hour}</li>
              ))}
            </ul>
          </div>
        )}

        {stats.freeSlots.length > 0 && (
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
              ✅ Freie Zeiten
            </p>
            <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
              {stats.freeSlots.map((slot, idx) => (
                <li key={idx}>{slot}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
