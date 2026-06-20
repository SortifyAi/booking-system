import assert from 'node:assert/strict'
import { blockOverlapsRange, blockBlocksSlot } from './block-availability.ts'

// Ein mehrtägiger Urlaub, 20.–25.06. (Ende inklusive Tagesende).
const vacation = {
  start_time: '2026-06-20T00:00:00.000Z',
  end_time: '2026-06-25T23:59:59.999Z',
  resource_id: 'staff-1',
}

// --- blockOverlapsRange: die Tages-Auswahl, die den Bug hatte ---------------

const day = (iso) => ({
  start: new Date(`${iso}T00:00:00.000Z`),
  end: new Date(`${iso}T23:59:59.999Z`),
})

// Regression: ein Tag MITTEN im Urlaub muss den Block finden. Ein
// Containment-Filter (start >= dayStart && end <= dayEnd) lieferte hier nichts
// und ließ Buchungen trotz Urlaub durch.
const mid = day('2026-06-22')
assert.equal(
  blockOverlapsRange(vacation, mid.start, mid.end),
  true,
  'mehrtägiger Urlaub überlappt einen Tag in seiner Mitte',
)

// Rand-Tage (erster/letzter) zählen ebenfalls.
const first = day('2026-06-20')
const last = day('2026-06-25')
assert.equal(blockOverlapsRange(vacation, first.start, first.end), true, 'erster Urlaubstag')
assert.equal(blockOverlapsRange(vacation, last.start, last.end), true, 'letzter Urlaubstag')

// Tage außerhalb des Urlaubs nicht.
const before = day('2026-06-19')
const after = day('2026-06-26')
assert.equal(blockOverlapsRange(vacation, before.start, before.end), false, 'Tag vor dem Urlaub')
assert.equal(blockOverlapsRange(vacation, after.start, after.end), false, 'Tag nach dem Urlaub')

// Eintagesblock (Tagesbeginn bis Tagesende) deckt seinen eigenen Tag ab –
// nicht der Null-Dauer-Fall, der früher unsichtbar war und nichts blockte.
const fullDay = { start_time: '2026-07-01T00:00:00.000Z', end_time: '2026-07-01T23:59:59.999Z' }
const itsDay = day('2026-07-01')
assert.equal(blockOverlapsRange(fullDay, itsDay.start, itsDay.end), true, 'Eintagesblock deckt seinen Tag')

// --- blockBlocksSlot: pro-Slot-Konflikt + Mitarbeiterbezug -----------------

const slot = (startIso, endIso) => [new Date(startIso), new Date(endIso)]

// Slot innerhalb des Urlaubs ist für den betroffenen Mitarbeiter blockiert.
const [s1, e1] = slot('2026-06-22T10:00:00.000Z', '2026-06-22T11:00:00.000Z')
assert.equal(blockBlocksSlot(vacation, s1, e1, 'staff-1'), true, 'Slot im Urlaub blockiert eigenen Mitarbeiter')

// … aber nicht für einen anderen Mitarbeiter (Block ist resource-spezifisch).
assert.equal(blockBlocksSlot(vacation, s1, e1, 'staff-2'), false, 'resource-spezifischer Block trifft andere nicht')

// Globaler Block (kein resource_id) blockiert jeden Mitarbeiter.
const globalBlock = { start_time: '2026-06-22T00:00:00.000Z', end_time: '2026-06-22T23:59:59.999Z' }
assert.equal(blockBlocksSlot(globalBlock, s1, e1, 'staff-2'), true, 'globaler Block trifft alle')
assert.equal(blockBlocksSlot(globalBlock, s1, e1, undefined), true, 'globaler Block ohne staffId trifft')

// Sich nur berührende Kanten sind kein Konflikt (Slot endet, wenn Block beginnt).
const touchingBlock = { start_time: '2026-06-22T11:00:00.000Z', end_time: '2026-06-22T12:00:00.000Z', resource_id: 'staff-1' }
assert.equal(blockBlocksSlot(touchingBlock, s1, e1, 'staff-1'), false, 'berührende Kante ist kein Konflikt')

console.log('block-availability: alle Assertions bestanden')
