import assert from 'node:assert/strict'
import {
  getBundesland,
  getExceptions,
  findException,
  getExceptionWindow,
  resolveClosedReason,
} from './holidays'

async function main() {
  // --- pure helpers (no network) ---
  assert.equal(getBundesland({ bundesland: 'by' }), 'BY', 'normalizes case')
  assert.equal(getBundesland({ bundesland: 'XX' }), '', 'rejects unknown codes')
  assert.equal(getBundesland(null), '', 'tolerates null settings')

  const settings = {
    bundesland: 'BY',
    exceptions: [
      { date: '2026-12-31', closed: false, open: '09:00', close: '13:00' },
      { date: '2026-12-24', closed: true, note: 'Heiligabend' },
      { date: '2026-11-05', closed: true },
    ],
  }

  assert.equal(getExceptions(settings).length, 3)
  assert.equal(findException(settings, '2026-12-24')?.note, 'Heiligabend')
  assert.deepEqual(getExceptionWindow(settings, '2026-12-31'), { open: '09:00', close: '13:00' })
  assert.equal(getExceptionWindow(settings, '2026-12-24'), null, 'closed day has no window')
  assert.equal(getExceptionWindow(settings, '2026-06-01'), null, 'no exception → no window')

  // --- resolveClosedReason: exception path needs no network ---
  assert.equal(await resolveClosedReason(settings, '2026-12-24'), 'Heiligabend', 'closed note')
  assert.equal(await resolveClosedReason(settings, '2026-11-05'), 'Geschlossen', 'closed without note')
  assert.equal(await resolveClosedReason(settings, '2026-12-31'), null, 'custom hours → open')

  // --- holiday path with mocked feiertage-api ---
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes('nur_land=BY') && String(url).includes('jahr=2099')) {
      return {
        ok: true,
        json: async () => ({ Neujahrstag: { datum: '2099-01-01', hinweis: '' } }),
      } as Response
    }
    return { ok: true, json: async () => ({}) } as Response
  }) as typeof fetch

  assert.equal(
    await resolveClosedReason({ bundesland: 'BY' }, '2099-01-01'),
    'Feiertag: Neujahrstag',
    'holiday closes the day'
  )
  assert.equal(
    await resolveClosedReason({ bundesland: 'BY' }, '2099-01-02'),
    null,
    'non-holiday is open'
  )
  // An exception with custom hours overrides the holiday (owner opens anyway).
  assert.equal(
    await resolveClosedReason(
      { bundesland: 'BY', exceptions: [{ date: '2099-01-01', closed: false, open: '10:00', close: '12:00' }] },
      '2099-01-01'
    ),
    null,
    'exception wins over holiday'
  )

  // --- API failure must never block bookings (fresh code/year → no cache) ---
  globalThis.fetch = (async () => {
    throw new Error('network down')
  }) as typeof fetch
  assert.equal(
    await resolveClosedReason({ bundesland: 'BE' }, '2097-05-01'),
    null,
    'upstream failure → treated as open'
  )

  globalThis.fetch = realFetch
  console.log('holidays.test.ts: all assertions passed')
}

main()
