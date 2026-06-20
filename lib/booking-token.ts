import { randomBytes } from 'crypto'

/**
 * Generate a cryptographically strong, URL-safe token used as the secret
 * "magic link" for managing a booking without a login. 32 bytes = 256 bits.
 */
export function generateManageToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Build the public URL where a customer can view/cancel their booking.
 * Falls back to a relative path if NEXT_PUBLIC_APP_URL is not configured.
 */
export function buildManageUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return `${base}/termin/${token}`
}

/**
 * Build the public URL that serves this booking as a downloadable .ics file,
 * used by the "Add to calendar" (Apple/Outlook desktop) button in emails.
 */
export function buildIcsUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return `${base}/api/public/bookings/${token}/ics`
}
