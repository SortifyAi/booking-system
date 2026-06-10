// @ts-nocheck
/**
 * Cron job to send booking reminders (runs hourly, see vercel.json).
 * Sends a reminder for every confirmed booking starting within the next 24h
 * that hasn't been reminded yet.
 *
 * Auth: Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>`
 * when the CRON_SECRET env var is set. We also accept a legacy `x-cron-secret`
 * header for manual/external triggers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBookingsNeedingReminder, sendBookingReminder, markReminderSent } from '@/lib/email'
import { buildManageUrl } from '@/lib/booking-token'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // If no secret configured, allow (e.g. local dev). Strongly recommended to set it.
  if (!secret) return true

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true

  const legacy = request.headers.get('x-cron-secret')
  if (legacy === secret) return true

  return false
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const bookings = await getBookingsNeedingReminder(24) // next 24 hours

    let sent = 0
    let failed = 0

    for (const booking of bookings) {
      try {
        const result = await sendBookingReminder({
          customerName: booking.customer_name,
          customerEmail: booking.customer_email,
          offeringName: booking.offerings?.name || 'Service',
          locationName: booking.locations?.name || 'Standort',
          locationAddress: booking.locations?.address || '',
          startTime: booking.start_time,
          endTime: booking.end_time,
          organizationName: booking.organizations?.name || 'Terminbuchung',
          manageUrl: booking.manage_token ? buildManageUrl(booking.manage_token) : undefined,
          organizationId: booking.organization_id,
          bookingId: booking.id,
        })

        if (result.success) {
          await markReminderSent(booking.id)
          sent++
        } else {
          // Mark as sent even when skipped (email not configured) so we don't
          // re-attempt every hour; real send failures are left for retry.
          if (result.skipped) {
            await markReminderSent(booking.id)
          }
          failed++
        }
      } catch (error) {
        console.error(`Failed to send reminder for booking ${booking.id}:`, error)
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      processed: bookings.length,
      sent,
      failed,
    })
  } catch (error) {
    console.error('Error in reminder cron:', error)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
