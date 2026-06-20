import assert from 'node:assert/strict'
import {
  getBookingDisplayParts,
  getBookingStaffId,
  getStaffLabel,
  normalizeCalendarBooking,
} from './calendar-admin.ts'

const staffMembers = [
  { id: 'res-anna', name: 'Anna Weber', color: '#8B5CF6' },
  { id: 'res-marc', name: 'Marc Bauer', color: '#3B82F6' },
]

const bookingFromDatabase = normalizeCalendarBooking(
  {
    id: 'booking-1',
    organization_id: 'org-1',
    group_id: 'group-1',
    customer_name: 'Lena Hoffmann',
    start_time: '2026-05-25T09:00:00.000Z',
    end_time: '2026-05-25T10:00:00.000Z',
    status: 'confirmed',
    location_id: 'loc-berlin',
    offering_id: 'off-cut',
    resource_id: 'res-anna',
    offerings: { name: 'Haarschnitt' },
  },
  staffMembers
)

assert.equal(bookingFromDatabase.guest_name, 'Lena Hoffmann')
assert.equal(bookingFromDatabase.service, 'Haarschnitt')
assert.equal(bookingFromDatabase.staff_id, 'res-anna')
assert.equal(bookingFromDatabase.staff_name, 'Anna Weber')
assert.equal(bookingFromDatabase.organization_id, 'org-1')
assert.equal(bookingFromDatabase.group_id, 'group-1')

const legacyBooking = normalizeCalendarBooking(
  {
    id: 'legacy-1',
    guest_name: 'Tom Berger',
    service: 'Massage',
    start_time: '2026-05-25T11:00:00.000Z',
    end_time: '2026-05-25T12:00:00.000Z',
    status: 'pending',
    location_id: 'loc-berlin',
    staff_id: 'staff-marc',
  },
  staffMembers
)

assert.equal(getBookingStaffId(legacyBooking), 'staff-marc')
assert.equal(getStaffLabel(legacyBooking), 'Marc')

assert.deepEqual(getBookingDisplayParts(bookingFromDatabase), {
  title: 'Lena Hoffmann',
  staffLabel: 'Anna Weber',
})
