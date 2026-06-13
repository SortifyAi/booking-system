/**
 * Booking policies (e.g. how long before an appointment a customer may still
 * cancel online). Stored per organization in `organizations.settings`, with a
 * sensible default so it works before anything is configured.
 */

export const DEFAULT_CANCELLATION_CUTOFF_HOURS = 24

type OrgSettings = {
  cancellationCutoffHours?: unknown
  showPrices?: unknown
  showDuration?: unknown
  requiredCustomerFields?: unknown
  privacyPolicyUrl?: unknown
  avvAcceptedAt?: unknown
  avvVersion?: unknown
} | null

/**
 * Fallback privacy policy shown to customers when an organisation has not set
 * its own. Points at the platform-level notice on the marketing site.
 */
export const DEFAULT_PRIVACY_POLICY_URL = 'https://bookanord.de/datenschutz'

/**
 * URL of the organisation's own privacy policy, shown on the public booking
 * page. For a customer's booking data the organisation (not bookanord) is the
 * data controller, so it should link to its own Datenschutzerklärung; we fall
 * back to the platform notice when none is configured.
 */
export function getPrivacyPolicyUrl(orgSettings: unknown): string {
  const value = (orgSettings as OrgSettings)?.privacyPolicyUrl
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : DEFAULT_PRIVACY_POLICY_URL
}

/** Current version of the Auftragsverarbeitungsvertrag (AVV) presented to org owners. */
export const CURRENT_AVV_VERSION = '2026-06-12'

export type AvvAcceptance = {
  acceptedAt: string | null
  version: string | null
}

/** Read whether (and which version of) the AVV an organisation has accepted. */
export function getAvvAcceptance(orgSettings: unknown): AvvAcceptance {
  const settings = orgSettings as OrgSettings
  const acceptedAt = settings?.avvAcceptedAt
  const version = settings?.avvVersion
  return {
    acceptedAt: typeof acceptedAt === 'string' ? acceptedAt : null,
    version: typeof version === 'string' ? version : null,
  }
}

/**
 * Which optional customer fields the organisation has made mandatory on the
 * public booking page. Name and e-mail are always required (needed for the
 * confirmation mail and DB constraints), so only these toggles are configurable.
 */
export type RequiredCustomerFields = {
  phone: boolean
  notes: boolean
}

export const DEFAULT_REQUIRED_CUSTOMER_FIELDS: RequiredCustomerFields = {
  phone: false,
  notes: false,
}

/** Read which customer fields are mandatory from an org's settings JSON. */
export function getRequiredCustomerFields(orgSettings: unknown): RequiredCustomerFields {
  const value = (orgSettings as OrgSettings)?.requiredCustomerFields as
    | Partial<RequiredCustomerFields>
    | undefined
  return {
    phone: value?.phone === true,
    notes: value?.notes === true,
  }
}

/** Read the cancellation cutoff (in hours) from an org's settings JSON. */
export function getCancellationCutoffHours(orgSettings: unknown): number {
  const value = (orgSettings as OrgSettings)?.cancellationCutoffHours
  return typeof value === 'number' && value >= 0
    ? value
    : DEFAULT_CANCELLATION_CUTOFF_HOURS
}

/** Whether prices should be shown to customers on the booking page. Default: true. */
export function getShowPrices(orgSettings: unknown): boolean {
  const value = (orgSettings as OrgSettings)?.showPrices
  return value === false ? false : true
}

/** Whether service duration should be shown to customers on the booking page. Default: true. */
export function getShowDuration(orgSettings: unknown): boolean {
  const value = (orgSettings as OrgSettings)?.showDuration
  return value === false ? false : true
}

/**
 * Whether a booking starting at `startTime` may still be cancelled now.
 * `cutoffHours = 0` means "anytime up to the start".
 */
export function canCancelBooking(
  startTime: string,
  cutoffHours: number,
  now: Date = new Date()
): boolean {
  const start = new Date(startTime).getTime()
  const deadline = start - cutoffHours * 60 * 60 * 1000
  return now.getTime() <= deadline
}
