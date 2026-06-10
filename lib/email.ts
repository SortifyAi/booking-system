// @ts-nocheck
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const resend = new Resend(RESEND_API_KEY || 're_placeholder')

/**
 * Whether a real email provider is configured. Without this, all send
 * functions skip gracefully (and record a "failed" notification) instead of
 * firing requests with a dummy key.
 */
export function isEmailConfigured(): boolean {
  return (
    !!RESEND_API_KEY &&
    RESEND_API_KEY !== 're_placeholder' &&
    RESEND_API_KEY !== 're_123456789'
  )
}

/**
 * Build the From address. Priority:
 *   1. EMAIL_FROM (full address, e.g. "Salon Müller <termine@salon.de>")
 *   2. EMAIL_DOMAIN (e.g. "salon.de" -> "<orgName> <termine@salon.de>")
 *   3. Resend sandbox sender (works without domain verification, but only
 *      delivers to the Resend account owner – good enough for first tests).
 */
function getFromAddress(organizationName: string): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM
  const safeName = (organizationName || 'Terminbuchung').replace(/[<>"]/g, '').trim()
  const domain = process.env.EMAIL_DOMAIN
  if (domain) return `${safeName} <termine@${domain}>`
  return `${safeName} <onboarding@resend.dev>`
}

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
  manageUrl?: string
  // For delivery tracking in notification_log:
  organizationId?: string
  bookingId?: string
}

type NotificationType = 'confirmation' | 'reminder' | 'cancellation' | 'update'

/**
 * Record an email attempt in notification_log. Uses the service client because
 * notification_log has RLS enabled without a public INSERT policy.
 */
async function logNotification(params: {
  organizationId?: string
  bookingId?: string
  type: NotificationType
  recipient: string
  status: 'sent' | 'failed'
  providerId?: string | null
  error?: string | null
}) {
  if (!params.organizationId) return
  try {
    const client = createServiceClient()
    await client.from('notification_log').insert({
      organization_id: params.organizationId,
      booking_id: params.bookingId ?? null,
      type: params.type,
      channel: 'email',
      recipient: params.recipient,
      status: params.status,
      provider_id: params.providerId ?? null,
      error: params.error ?? null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    })
  } catch (e) {
    console.error('Failed to write notification_log:', e)
  }
}

function formatDateDE(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTimeDE(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Core send + log. Returns { success, skipped?, data?, error? }.
 */
async function sendAndLog(
  data: BookingEmailData,
  type: NotificationType,
  subject: string,
  html: string
) {
  if (!isEmailConfigured()) {
    console.warn(
      `[email] RESEND_API_KEY not configured – skipping ${type} email to ${data.customerEmail}`
    )
    await logNotification({
      organizationId: data.organizationId,
      bookingId: data.bookingId,
      type,
      recipient: data.customerEmail,
      status: 'failed',
      error: 'EMAIL_NOT_CONFIGURED',
    })
    return { success: false, skipped: true }
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: getFromAddress(data.organizationName),
      to: data.customerEmail,
      subject,
      html,
    })

    if (error) {
      console.error(`Error sending ${type} email:`, error)
      await logNotification({
        organizationId: data.organizationId,
        bookingId: data.bookingId,
        type,
        recipient: data.customerEmail,
        status: 'failed',
        error: typeof error === 'string' ? error : JSON.stringify(error),
      })
      return { success: false, error }
    }

    await logNotification({
      organizationId: data.organizationId,
      bookingId: data.bookingId,
      type,
      recipient: data.customerEmail,
      status: 'sent',
      providerId: result?.id ?? null,
    })
    return { success: true, data: result }
  } catch (error) {
    console.error(`Error sending ${type} email:`, error)
    await logNotification({
      organizationId: data.organizationId,
      bookingId: data.bookingId,
      type,
      recipient: data.customerEmail,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error }
  }
}

const emailFooter = (organizationName: string) => `
  <p>Wir freuen uns auf Sie!</p>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    ${organizationName}<br>
    Diese E-Mail wurde automatisch generiert.
  </p>
`

const manageBlock = (manageUrl?: string) =>
  manageUrl
    ? `
      <p style="margin: 20px 0;">
        Falls Sie den Termin nicht wahrnehmen können, stornieren Sie ihn bitte hier:
      </p>
      <p>
        <a href="${manageUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Termin verwalten / stornieren</a>
      </p>
    `
    : ''

/**
 * Send booking confirmation email to customer
 */
export async function sendBookingConfirmation(data: BookingEmailData) {
  const formattedDate = formatDateDE(data.startTime)
  const formattedTime = formatTimeDE(data.startTime)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Terminbestätigung</h1>
      <p>Hallo ${data.customerName},</p>
      <p>Ihre Buchung wurde bestätigt:</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Service:</strong> ${data.offeringName}</p>
        <p><strong>Datum:</strong> ${formattedDate}</p>
        <p><strong>Uhrzeit:</strong> ${formattedTime}</p>
        <p><strong>Ort:</strong> ${data.locationName}<br><small>${data.locationAddress}</small></p>
      </div>

      ${manageBlock(data.manageUrl)}
      ${emailFooter(data.organizationName)}
    </div>
  `

  return sendAndLog(
    data,
    'confirmation',
    `Bestätigung: Ihr Termin am ${formattedDate}`,
    html
  )
}

/**
 * Send booking cancellation confirmation to customer
 */
export async function sendBookingCancellation(data: BookingEmailData) {
  const formattedDate = formatDateDE(data.startTime)
  const formattedTime = formatTimeDE(data.startTime)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Termin storniert</h1>
      <p>Hallo ${data.customerName},</p>
      <p>Ihr folgender Termin wurde storniert:</p>

      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Service:</strong> ${data.offeringName}</p>
        <p><strong>Datum:</strong> ${formattedDate}</p>
        <p><strong>Uhrzeit:</strong> ${formattedTime}</p>
        <p><strong>Ort:</strong> ${data.locationName}</p>
      </div>

      <p>Buchen Sie jederzeit gerne einen neuen Termin.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        ${data.organizationName}<br>
        Diese E-Mail wurde automatisch generiert.
      </p>
    </div>
  `

  return sendAndLog(
    data,
    'cancellation',
    `Stornierung: Ihr Termin am ${formattedDate}`,
    html
  )
}

/**
 * Send booking reminder email to customer
 */
export async function sendBookingReminder(data: BookingEmailData) {
  const formattedDate = formatDateDE(data.startTime)
  const formattedTime = formatTimeDE(data.startTime)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Terminerinnerung</h1>
      <p>Hallo ${data.customerName},</p>
      <p>wir möchten Sie an Ihren bevorstehenden Termin erinnern:</p>

      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Service:</strong> ${data.offeringName}</p>
        <p><strong>Datum:</strong> ${formattedDate}</p>
        <p><strong>Uhrzeit:</strong> ${formattedTime}</p>
        <p><strong>Ort:</strong> ${data.locationName}<br><small>${data.locationAddress}</small></p>
      </div>

      ${manageBlock(data.manageUrl)}
      ${emailFooter(data.organizationName)}
    </div>
  `

  return sendAndLog(
    data,
    'reminder',
    `Erinnerung: Ihr Termin am ${formattedDate} bei ${data.organizationName}`,
    html
  )
}

/**
 * Get bookings that need a reminder within the next `hoursBefore` hours.
 * Called by the reminder cron job. Uses the service client (no user session).
 */
export async function getBookingsNeedingReminder(hoursBefore = 24) {
  const client = createServiceClient()

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
  const client = createServiceClient()

  const { error } = await client
    .from('bookings')
    .update({ reminder_sent: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) {
    console.error('Error marking reminder sent:', error)
  }
}
