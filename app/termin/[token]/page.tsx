'use client'

import { use, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Calendar, Clock, User, MapPin, Check, AlertCircle, XCircle } from 'lucide-react'

interface ManagedBooking {
  customerName: string
  startTime: string
  endTime: string
  status: string
  serviceName: string | null
  priceCents: number | null
  staffName: string | null
  locationName: string | null
  locationAddress: string | null
  organizationName: string | null
  organizationLogoUrl: string | null
}

export default function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [booking, setBooking] = useState<ManagedBooking | null>(null)
  const [canCancel, setCanCancel] = useState(false)
  const [cutoffHours, setCutoffHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
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
                {booking.serviceName && (
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">{booking.serviceName}</span>
                    {booking.priceCents != null && (
                      <span className="ml-auto text-gray-500">{formatPrice(booking.priceCents)}</span>
                    )}
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
                {booking.staffName && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <span>{booking.staffName}</span>
                  </div>
                )}
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
