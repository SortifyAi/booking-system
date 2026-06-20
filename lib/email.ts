// @ts-nocheck
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { getReminderDayWindow } from '@/lib/reminders'
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from '@/lib/calendar-links'
import { buildIcsUrl } from '@/lib/booking-token'
import { DEFAULT_TIMEZONE, formatDateInTimeZone, formatTimeInTimeZone } from '@/lib/timezone'

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

/**
 * Reply-To address. Spam filters (esp. Outlook) treat a deliverable Reply-To
 * more favourably than a bare "noreply" From. Priority:
 *   1. EMAIL_REPLY_TO (explicit)
 *   2. the email part of EMAIL_FROM / EMAIL_DOMAIN
 *   3. none
 */
function getReplyTo(): string | undefined {
  if (process.env.EMAIL_REPLY_TO) return process.env.EMAIL_REPLY_TO
  if (process.env.EMAIL_FROM) {
    const match = process.env.EMAIL_FROM.match(/<([^>]+)>/)
    return match ? match[1] : process.env.EMAIL_FROM
  }
  if (process.env.EMAIL_DOMAIN) return `termine@${process.env.EMAIL_DOMAIN}`
  return undefined
}

interface BookingEmailData {
  customerName: string
  customerEmail: string
  offeringName: string
  // Zusatzleistungen einer Einzelbuchung (Namen), z.B. ["Augenbrauen zupfen"].
  addonNames?: string[]
  // Positionen einer Sammelbuchung für mehrere Personen. Hat Vorrang vor
  // offeringName/addonNames, wenn mehr als eine Position vorhanden ist.
  items?: { serviceName: string; staffName?: string | null; addons?: string[] }[]
  locationName: string
  locationAddress: string
  startTime: string
  endTime: string
  // IANA timezone of the location. Emails render on a UTC server, so the
  // wall-clock time must be derived in the location's timezone, not the host's.
  timeZone?: string
  notes?: string
  organizationName: string
  manageUrl?: string
  // Secret token of the booking. Enables the "Apple Kalender" (.ics) button.
  manageToken?: string
  // For delivery tracking in notification_log:
  organizationId?: string
  bookingId?: string
}

interface CalendarLinks {
  google: string
  outlook: string
  ics?: string
}

/**
 * Build the "add to calendar" links for a booking. Google/Outlook are derived
 * purely from the event data; the .ics download needs the booking's token.
 */
function buildCalendarLinks(data: BookingEmailData): CalendarLinks {
  const event = {
    uid: `booking-${data.bookingId ?? data.manageToken ?? data.startTime}@bookanord`,
    title: `${data.offeringName} – ${data.organizationName}`,
    description: `Ihr Termin bei ${data.organizationName}.`,
    location: [data.locationName, data.locationAddress].filter(Boolean).join(', '),
    start: data.startTime,
    end: data.endTime,
  }
  return {
    google: buildGoogleCalendarUrl(event),
    outlook: buildOutlookCalendarUrl(event),
    ics: data.manageToken ? buildIcsUrl(data.manageToken) : undefined,
  }
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

function formatDateDE(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatDateInTimeZone(iso, timeZone, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTimeDE(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatTimeInTimeZone(iso, timeZone)
}

/**
 * Core send + log. Returns { success, skipped?, data?, error? }.
 */
async function sendAndLog(
  data: BookingEmailData,
  type: NotificationType,
  subject: string,
  html: string,
  text: string
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
    const replyTo = getReplyTo()
    const { data: result, error } = await resend.emails.send({
      from: getFromAddress(data.organizationName),
      to: data.customerEmail,
      ...(replyTo ? { replyTo } : {}),
      subject,
      html,
      text,
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

/**
 * Plain-text counterpart of an email. A text/plain alternative alongside the
 * HTML markedly improves deliverability (spam filters distrust HTML-only mail).
 */
function buildPlainText(opts: {
  heading: string
  intro: string
  data: BookingEmailData
  manageUrl?: string
  calendarLinks?: CalendarLinks
  closing?: string
}): string {
  const { heading, intro, data, manageUrl, calendarLinks, closing } = opts
  const lines = [
    heading,
    '',
    `Hallo ${data.customerName},`,
    '',
    intro,
    '',
    ...serviceSummaryTextLines(data),
    `Datum: ${formatDateDE(data.startTime, data.timeZone)}`,
    `Uhrzeit: ${formatTimeDE(data.startTime, data.timeZone)} Uhr`,
    `Ort: ${data.locationName}${data.locationAddress ? `, ${data.locationAddress}` : ''}`,
  ]
  if (calendarLinks) {
    lines.push('', 'Zum Kalender hinzufügen:', `Google: ${calendarLinks.google}`)
    if (calendarLinks.ics) lines.push(`Apple Kalender: ${calendarLinks.ics}`)
    lines.push(`Outlook: ${calendarLinks.outlook}`)
  }
  if (manageUrl) {
    lines.push(
      '',
      'Termin verwalten oder stornieren:',
      manageUrl
    )
  }
  lines.push('', closing || 'Wir freuen uns auf Sie!', '', data.organizationName, 'Diese E-Mail wurde automatisch generiert.')
  return lines.join('\n')
}

const calButton = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block; background:#fff; border:1px solid #d1d5db; color:#111827; padding:9px 14px; border-radius:6px; text-decoration:none; margin:0 6px 8px 0; font-size:14px;">📅 ${label}</a>`

/**
 * "Zum Kalender hinzufügen" buttons. Google/Outlook are always shown; the
 * Apple/desktop .ics button only when a token-based download URL is available.
 */
const addToCalendarBlock = (links: CalendarLinks) => `
  <p style="margin: 24px 0 8px;"><strong>Zum Kalender hinzufügen:</strong></p>
  <p style="margin: 0;">
    ${calButton(links.google, 'Google Kalender')}
    ${links.ics ? calButton(links.ics, 'Apple Kalender') : ''}
    ${calButton(links.outlook, 'Outlook')}
  </p>
`

/**
 * Renders the booked service(s) for an email body. Handles three cases:
 * a single service, a single service with add-ons, and a multi-person group.
 */
function serviceSummaryHtml(data: BookingEmailData): string {
  if (data.items && data.items.length > 1) {
    const rows = data.items
      .map((item, idx) => {
        const addons = item.addons?.length
          ? `<br><small style="color:#555;">+ ${item.addons.join(', ')}</small>`
          : ''
        const staff = item.staffName ? ` <small style="color:#555;">(${item.staffName})</small>` : ''
        return `<p style="margin:0 0 6px;"><strong>Person ${idx + 1}:</strong> ${item.serviceName}${staff}${addons}</p>`
      })
      .join('')
    return rows
  }
  const addonLine = data.addonNames?.length
    ? `<p><strong>Zusatzleistungen:</strong> ${data.addonNames.join(', ')}</p>`
    : ''
  return `<p><strong>Service:</strong> ${data.offeringName}</p>${addonLine}`
}

function serviceSummaryTextLines(data: BookingEmailData): string[] {
  if (data.items && data.items.length > 1) {
    return data.items.map((item, idx) => {
      const addons = item.addons?.length ? ` (+ ${item.addons.join(', ')})` : ''
      const staff = item.staffName ? ` – ${item.staffName}` : ''
      return `Person ${idx + 1}: ${item.serviceName}${staff}${addons}`
    })
  }
  const lines = [`Service: ${data.offeringName}`]
  if (data.addonNames?.length) lines.push(`Zusatzleistungen: ${data.addonNames.join(', ')}`)
  return lines
}

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
  const formattedDate = formatDateDE(data.startTime, data.timeZone)
  const formattedTime = formatTimeDE(data.startTime, data.timeZone)
  const calendarLinks = buildCalendarLinks(data)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Terminbestätigung</h1>
      <p>Hallo ${data.customerName},</p>
      <p>Ihre Buchung wurde bestätigt:</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${serviceSummaryHtml(data)}
        <p><strong>Datum:</strong> ${formattedDate}</p>
        <p><strong>Uhrzeit:</strong> ${formattedTime}</p>
        <p><strong>Ort:</strong> ${data.locationName}<br><small>${data.locationAddress}</small></p>
      </div>

      ${addToCalendarBlock(calendarLinks)}
      ${manageBlock(data.manageUrl)}
      ${emailFooter(data.organizationName)}
    </div>
  `

  const text = buildPlainText({
    heading: 'Terminbestätigung',
    intro: 'Ihre Buchung wurde bestätigt:',
    data,
    manageUrl: data.manageUrl,
    calendarLinks,
  })

  return sendAndLog(
    data,
    'confirmation',
    `Bestätigung: Ihr Termin am ${formattedDate}`,
    html,
    text
  )
}

/**
 * Notify the customer that their appointment has been moved to a new time.
 */
export async function sendBookingUpdate(data: BookingEmailData) {
  const formattedDate = formatDateDE(data.startTime, data.timeZone)
  const formattedTime = formatTimeDE(data.startTime, data.timeZone)
  const calendarLinks = buildCalendarLinks(data)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Termin verschoben</h1>
      <p>Hallo ${data.customerName},</p>
      <p>Ihr Termin wurde erfolgreich verschoben. Hier sind die neuen Details:</p>

      <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Service:</strong> ${data.offeringName}</p>
        <p><strong>Datum:</strong> ${formattedDate}</p>
        <p><strong>Uhrzeit:</strong> ${formattedTime}</p>
        <p><strong>Ort:</strong> ${data.locationName}<br><small>${data.locationAddress}</small></p>
      </div>

      ${addToCalendarBlock(calendarLinks)}
      ${manageBlock(data.manageUrl)}
      ${emailFooter(data.organizationName)}
    </div>
  `

  const text = buildPlainText({
    heading: 'Termin verschoben',
    intro: 'Ihr Termin wurde erfolgreich verschoben. Hier sind die neuen Details:',
    data,
    manageUrl: data.manageUrl,
    calendarLinks,
  })

  return sendAndLog(
    data,
    'update',
    `Termin verschoben: Ihr neuer Termin am ${formattedDate}`,
    html,
    text
  )
}

/**
 * Send booking cancellation confirmation to customer
 */
export async function sendBookingCancellation(data: BookingEmailData) {
  const formattedDate = formatDateDE(data.startTime, data.timeZone)
  const formattedTime = formatTimeDE(data.startTime, data.timeZone)

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

  const text = buildPlainText({
    heading: 'Termin storniert',
    intro: 'Ihr folgender Termin wurde storniert:',
    data,
    closing: 'Buchen Sie jederzeit gerne einen neuen Termin.',
  })

  return sendAndLog(
    data,
    'cancellation',
    `Stornierung: Ihr Termin am ${formattedDate}`,
    html,
    text
  )
}

/**
 * Send booking reminder email to customer
 */
export async function sendBookingReminder(data: BookingEmailData) {
  const formattedDate = formatDateDE(data.startTime, data.timeZone)
  const formattedTime = formatTimeDE(data.startTime, data.timeZone)
  const calendarLinks = buildCalendarLinks(data)

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

      ${addToCalendarBlock(calendarLinks)}
      ${manageBlock(data.manageUrl)}
      ${emailFooter(data.organizationName)}
    </div>
  `

  const text = buildPlainText({
    heading: 'Terminerinnerung',
    intro: 'wir möchten Sie an Ihren bevorstehenden Termin erinnern:',
    data,
    manageUrl: data.manageUrl,
    calendarLinks,
  })

  return sendAndLog(
    data,
    'reminder',
    `Erinnerung: Ihr Termin am ${formattedDate} bei ${data.organizationName}`,
    html,
    text
  )
}

/**
 * Get bookings that need a reminder during today's local business day.
 * Called by the daily reminder cron job. Uses the service client (no user session).
 */
export async function getBookingsNeedingReminder(now = new Date()) {
  const client = createServiceClient()

  const { data: locations, error: locationError } = await client
    .from('locations')
    .select('id, timezone')

  if (locationError) {
    console.error('Error fetching locations for reminder:', locationError)
    return []
  }

  const batches = await Promise.all(
    (locations || []).map(async (location) => {
      const window = getReminderDayWindow(now, location.timezone)
      const { data: bookings, error } = await client
        .from('bookings')
        .select('*, offerings(*), locations(*), organizations(*)')
        .eq('location_id', location.id)
        .eq('status', 'confirmed')
        .gte('start_time', window.startIso)
        .lt('start_time', window.endIso)
        .is('reminder_sent', null)
        .order('start_time', { ascending: true })

      if (error) {
        console.error(
          `Error fetching bookings for reminder at location ${location.id}:`,
          error
        )
        return []
      }

      return bookings || []
    })
  )

  const uniqueBookings = new Map<string, any>()
  for (const booking of batches.flat()) {
    uniqueBookings.set(booking.id, booking)
  }

  return Array.from(uniqueBookings.values()).sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
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
