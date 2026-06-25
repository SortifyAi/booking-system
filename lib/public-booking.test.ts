import assert from 'node:assert/strict'
import { combineStaffAvailabilitySlots } from './public-booking.ts'

const slots = combineStaffAvailabilitySlots([
  {
    staffId: 'staff-a',
    staffName: 'Aboudy',
    priority: 2,
    slots: [
      {
        startTime: '2026-05-25T09:00:00.000Z',
        endTime: '2026-05-25T10:00:00.000Z',
        available: true,
      },
    ],
  },
  {
    staffId: 'staff-b',
    staffName: 'Arso',
    priority: 1,
    slots: [
      {
        startTime: '2026-05-25T09:00:00.000Z',
        endTime: '2026-05-25T10:00:00.000Z',
        available: true,
      },
    ],
  },
])

assert.equal(slots.length, 1)
assert.equal(slots[0].staffId, 'staff-b')
assert.equal(slots[0].staffName, 'Arso')
assert.equal(slots[0].available, true)
