// @ts-nocheck
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789')

interface BookingEmailData {
  customerName: string
  customerEmail: string
  offeringName: string
  locationName: string
  locationAddress: string
  startTime: string
  endTime: string
  notes?: string
  organizationName: string
}

/**
 * Send booking confirmation email to customer
 */
export async function sendBookingConfirmation(data: BookingEmailData) {
  const { customerName, customerEmail, offeringName, locationName, locationAddress, startTime, endTime, organizationName } = data

  const formattedDate = new Date(startTime).toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedTime = new Date(startTime).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  try {
    const result = await resend.emails.send({
      from: `${organizationName} <bookings@${process.env.EMAIL_DOMAIN || 'localhost'}>`,
      to: customerEmail,
      subject: `Bestätigung: Ihr Termin am ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Terminbestätigung</h1>
          <p>Hallo ${customerName},</p>
          <p>Ihre Buchung wurde bestätigt:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Service:</strong> ${offeringName}</p>
            <p><strong>Datum:</strong> ${formattedDate}</p>
            <p><strong>Uhrzeit:</strong> ${formattedTime}</p>
            <p><strong>Ort:</strong> ${locationName}<br><small>${locationAddress}</small></p>
          </div>
          
          <p>Wir freuen uns auf Sie!</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            ${organizationName}<br>
            Diese E-Mail wurde automatisch generiert.
          </p>
        </div>
      `,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Error sending confirmation email:', error)
    return { success: false, error }
  }
}

/**
 * Send booking reminder email to customer
 */
export async function sendBookingReminder(data: BookingEmailData) {
  const { customerName, customerEmail, offeringName, locationName, locationAddress, startTime, organizationName } = data

  const formattedDate = new Date(startTime).toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedTime = new Date(startTime).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  try {
    const result = await resend.emails.send({
      from: `${organizationName} <reminders@${process.env.EMAIL_DOMAIN || 'localhost'}>`,
      to: customerEmail,
      subject: `Erinnerung: Ihr Termin morgen bei ${organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Terminerinnerung</h1>
          <p>Hallo ${customerName},</p>
          <p>wir möchten Sie an Ihren bevorstehenden Termin erinnern:</p>
          
          <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Service:</strong> ${offeringName}</p>
            <p><strong>Datum:</strong> ${formattedDate}</p>
            <p><strong>Uhrzeit:</strong> ${formattedTime}</p>
            <p><strong>Ort:</strong> ${locationName}<br><small>${locationAddress}</small></p>
          </div>
          
          <p>Wir freuen uns auf Sie!</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            ${organizationName}<br>
            Diese E-Mail wurde automatisch generiert.
          </p>
        </div>
      `,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('Error sending reminder email:', error)
    return { success: false, error }
  }
}

/**
 * Get bookings that need reminder (24h before)
 * Called by cron job
 */
export async function getBookingsNeedingReminder(hoursBefore = 24) {
  const client = await createClient()
  
  const now = new Date()
  const reminderWindow = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000)
  
  const { data: bookings, error } = await client
    .from('bookings')
    .select('*, offerings(*), locations(*), organizations(*)')
    .eq('status', 'confirmed')
    .gte('start_time', now.toISOString())
    .lte('start_time', reminderWindow.toISOString())
    .is('reminder_sent', null)

  if (error) {
    console.error('Error fetching bookings for reminder:', error)
    return []
  }

  return bookings || []
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(bookingId: string) {
  const client = await createClient()
  
  const { error } = await client
    .from('bookings')
    .update({ reminder_sent: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) {
    console.error('Error marking reminder sent:', error)
  }
}