// @ts-nocheck
/**
 * Cron job to send booking reminders
 * Run this endpoint periodically (e.g., every hour)
 * 
 * Vercel Cron example:
 * {
 *   "path": "api/cron/reminders",
 *   "schedule": "0 * * * *"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBookingsNeedingReminder, sendBookingReminder, markReminderSent } from '@/lib/email'

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const cronSecret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const bookings = await getBookingsNeedingReminder(24) // 24 hours before

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
        })

        if (result.success) {
          await markReminderSent(booking.id)
          sent++
        } else {
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