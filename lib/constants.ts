// @ts-nocheck
/**
 * Application constants and configuration
 */

/**
 * Booking status colors for UI
 */
export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  no_show: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

/**
 * Resource types
 */
export const RESOURCE_TYPES = {
  staff: 'Mitarbeiter',
  room: 'Raum',
  equipment: 'Ausrüstung',
} as const;

/**
 * Duration presets for booking slots
 */
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180] as const;

/**
 * Business hours (default)
 */
export const BUSINESS_HOURS = {
  start: 7,
  end: 20,
} as const;

/**
 * Time slot interval in minutes
 */
export const TIME_SLOT_INTERVAL = 30;

/**
 * Timezone options
 */
export const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Chicago', label: 'Chicago (CST)' },
  { value: 'America/Denver', label: 'Denver (MST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Tokio (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
] as const;

/**
 * API error messages in German
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Netzwerkfehler. Bitte überprüfe deine Verbindung.',
  UNAUTHORIZED: 'Du bist nicht authentifiziert. Bitte melde dich an.',
  FORBIDDEN: 'Du hast keine Berechtigung für diese Aktion.',
  NOT_FOUND: 'Ressource nicht gefunden.',
  VALIDATION_ERROR: 'Validierungsfehler. Bitte überprüfe deine Eingaben.',
  SERVER_ERROR: 'Ein Fehler ist auf dem Server aufgetreten.',
  UNKNOWN_ERROR: 'Ein unbekannter Fehler ist aufgetreten.',
} as const;

/**
 * Success messages in German
 */
export const SUCCESS_MESSAGES = {
  CREATED: 'Erfolgreich erstellt.',
  UPDATED: 'Erfolgreich aktualisiert.',
  DELETED: 'Erfolgreich gelöscht.',
  SAVED: 'Erfolgreich gespeichert.',
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Cache duration in milliseconds
 */
export const CACHE_DURATION = {
  REALTIME: 0,
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;
