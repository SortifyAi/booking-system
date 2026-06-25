import assert from 'node:assert/strict';
import {
  getBlockStyleForDay,
  getBookingTimeStyle,
  getMaximumParallelBookings,
  layoutOverlappingBookings,
} from './calendar-layout.ts';

const sameMorning = [
  {
    id: 'booking-a',
    start_time: '2026-05-25T09:00:00',
    end_time: '2026-05-25T10:00:00',
  },
  {
    id: 'booking-b',
    start_time: '2026-05-25T09:15:00',
    end_time: '2026-05-25T10:15:00',
  },
];

const separateMorning = [
  {
    id: 'booking-c',
    start_time: '2026-05-25T09:00:00',
    end_time: '2026-05-25T10:00:00',
  },
  {
    id: 'booking-d',
    start_time: '2026-05-25T10:00:00',
    end_time: '2026-05-25T11:00:00',
  },
];

const overlappingLayout = layoutOverlappingBookings(sameMorning);
assert.equal(overlappingLayout.get('booking-a')?.columns, 2);
assert.equal(overlappingLayout.get('booking-b')?.columns, 2);
assert.notEqual(overlappingLayout.get('booking-a')?.column, overlappingLayout.get('booking-b')?.column);

const separateLayout = layoutOverlappingBookings(separateMorning);
assert.deepEqual(separateLayout.get('booking-c'), { column: 0, columns: 1 });
assert.deepEqual(separateLayout.get('booking-d'), { column: 0, columns: 1 });

const style = getBookingTimeStyle(sameMorning[0], 7 * 60, 72, 42);
assert.deepEqual(style, { top: 146, height: 68 });

const halfHourStyle = getBookingTimeStyle(
  {
    id: 'booking-half-hour',
    start_time: '2026-05-25T11:30:00',
    end_time: '2026-05-25T12:00:00',
  },
  9 * 60,
  72,
  40,
);
assert.deepEqual(halfHourStyle, { top: 182, height: 32 });

const followingHalfHourStyle = getBookingTimeStyle(
  {
    id: 'booking-following-half-hour',
    start_time: '2026-05-25T12:00:00',
    end_time: '2026-05-25T12:30:00',
  },
  9 * 60,
  72,
  40,
);
assert.deepEqual(followingHalfHourStyle, { top: 218, height: 32 });

const blockStyle = getBlockStyleForDay(
  {
    start_time: '2026-05-25T08:00:00',
    end_time: '2026-05-25T10:30:00',
  },
  new Date('2026-05-25T12:00:00'),
  9 * 60 + 30,
  18 * 60,
  72,
);
assert.deepEqual(blockStyle, { top: 0, height: 72 });

const busyMorning = [
  {
    id: 'booking-e',
    start_time: '2026-05-25T09:00:00',
    end_time: '2026-05-25T10:00:00',
  },
  {
    id: 'booking-f',
    start_time: '2026-05-25T09:15:00',
    end_time: '2026-05-25T09:45:00',
  },
  {
    id: 'booking-g',
    start_time: '2026-05-25T09:30:00',
    end_time: '2026-05-25T10:30:00',
  },
  {
    id: 'booking-h',
    start_time: '2026-05-25T10:30:00',
    end_time: '2026-05-25T11:00:00',
  },
];

assert.equal(getMaximumParallelBookings(busyMorning), 3);
assert.equal(getMaximumParallelBookings(separateMorning), 1);
assert.equal(getMaximumParallelBookings([]), 1);
