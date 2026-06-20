'use client'

export type BookingSubmissionError =
  | { kind: 'email'; message: string }
  | { kind: 'contact'; message: string; phone?: string | null }

export function PublicBookingSubmissionError({
  error,
}: {
  error: BookingSubmissionError | null
}) {
  if (!error) return null

  return (
    <div
      role="alert"
      className={
        error.kind === 'email'
          ? 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
          : 'rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      }
    >
      <p>{error.message}</p>
      {error.kind === 'contact' && error.phone && (
        <a href={`tel:${error.phone}`} className="mt-2 inline-block font-semibold underline">
          {error.phone}
        </a>
      )}
    </div>
  )
}
