import assert from 'node:assert/strict'
import {
  CALENDAR_SHARE_TOKEN_BYTES,
  filterUpcomingAllowedBookings,
  generateCalendarShareToken,
  normalizeAllowedResourceIds,
  serializePublicCalendarBooking,
} from './calendar-share.ts'

const token = generateCalendarShareToken()
assert.equal(CALENDAR_SHARE_TOKEN_BYTES, 32)
assert.ok(token.length >= 40)
assert.match(token, /^[A-Za-z0-9_-]+$/)

assert.deepEqual(
  normalizeAllowedResourceIds(['res-1', 'res-1', 'res-2', '', null, undefined]),
  ['res-1', 'res-2']
)

const publicBooking = serializePublicCalendarBooking({
  id: 'booking-1',
  customer_name: 'Mia Nord',
  customer_email: 'mia@example.com',
  customer_phone: '+49 123',
  notes: 'private note',
  metadata: { secret: true },
  start_time: '2026-06-15T09:00:00.000Z',
  end_time: '2026-06-15T10:00:00.000Z',
  status: 'confirmed',
  resource_id: 'staff-1',
  offerings: { name: 'Haarschnitt' },
  resources: { name: 'Anna' },
})

assert.deepEqual(Object.keys(publicBooking).sort(), [
  'customerName',
  'endTime',
  'id',
  'resourceId',
  'serviceName',
  'staffName',
  'startTime',
  'status',
])
assert.equal(publicBooking.customerName, 'Mia Nord')
assert.equal(publicBooking.serviceName, 'Haarschnitt')
assert.equal(publicBooking.staffName, 'Anna')
assert.equal('customer_email' in publicBooking, false)
assert.equal('customerPhone' in publicBooking, false)
assert.equal('notes' in publicBooking, false)
assert.equal('metadata' in publicBooking, false)

const filtered = filterUpcomingAllowedBookings(
  [
    { id: 'past', resource_id: 'staff-1', start_time: '2026-06-13T09:00:00.000Z' },
    { id: 'allowed', resource_id: 'staff-1', start_time: '2026-06-15T09:00:00.000Z' },
    { id: 'blocked', resource_id: 'staff-2', start_time: '2026-06-15T09:00:00.000Z' },
    { id: 'unassigned', resource_id: null, start_time: '2026-06-15T09:00:00.000Z' },
  ],
  ['staff-1'],
  '2026-06-14T00:00:00.000Z'
)
assert.deepEqual(filtered.map((item) => item.id), ['allowed'])
