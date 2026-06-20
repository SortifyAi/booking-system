import assert from 'node:assert/strict';
import {
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

const style = getBookingTimeStyle(sameMorning[0], 7, 72, 42);
assert.deepEqual(style, { top: 150, height: 62 });

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
