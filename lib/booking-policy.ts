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
} | null

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
