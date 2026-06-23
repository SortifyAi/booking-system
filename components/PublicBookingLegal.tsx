'use client'

const LANDING_PAGE_URL = 'https://bookanord.de'
const IMPRESSUM_URL = 'https://bookanord.de/impressum'
const DATENSCHUTZ_URL = 'https://bookanord.de/datenschutz'

interface PrivacyNoticeProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Organisation-specific privacy policy URL; falls back to the platform notice. */
  privacyUrl?: string
}

export function PublicBookingPrivacyNotice({ checked, onCheckedChange, privacyUrl }: PrivacyNoticeProps) {
  const datenschutzUrl = privacyUrl || DATENSCHUTZ_URL
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-gray-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-gray-200">
      <p className="font-medium text-gray-900 dark:text-white">Datenschutzhinweis</p>
      <p className="mt-1">
        Ihre Angaben werden ausschließlich zur Terminbuchung, Bestätigung, Erinnerung und Verwaltung
        dieses Termins verarbeitet.
      </p>
      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <span>
          Ich habe die{' '}
          <a
            href={datenschutzUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300"
          >
            Datenschutzinformationen
          </a>{' '}
          zur Kenntnis genommen.
        </span>
      </label>
    </div>
  )
}

export function PublicBookingFooter({ privacyUrl }: { privacyUrl?: string }) {
  const datenschutzUrl = privacyUrl || DATENSCHUTZ_URL
  return (
    <footer className="mt-8 pb-8 text-center text-sm text-slate-500 dark:text-slate-400">
      <a
        href={LANDING_PAGE_URL}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3.5 py-2 text-slate-600 shadow-sm shadow-slate-950/5 backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:border-slate-700/70 dark:bg-slate-900/55 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-white"
      >
        <span>Powered by</span>
        <img
          src="/brand/bookanord-logo.png"
          alt="bookanord"
          className="h-5 w-auto dark:brightness-0 dark:invert"
        />
      </a>
      <div className="mt-2 flex items-center justify-center gap-3">
        <a href={IMPRESSUM_URL} className="hover:text-slate-900 hover:underline dark:hover:text-white">
          Impressum
        </a>
        <span aria-hidden="true">|</span>
        <a href={datenschutzUrl} className="hover:text-slate-900 hover:underline dark:hover:text-white">
          Datenschutz
        </a>
      </div>
    </footer>
  )
}
