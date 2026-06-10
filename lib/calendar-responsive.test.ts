import assert from 'node:assert/strict';
import { addDays, format, startOfWeek } from 'date-fns';
import {
  getCalendarNavigationStep,
  getResponsiveWeekDayCount,
  getVisibleWeekDays,
} from './calendar-responsive';

const weekStart = startOfWeek(new Date('2026-05-25T12:00:00'), { weekStartsOn: 1 });
const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

assert.deepEqual(
  getVisibleWeekDays(days, new Date('2026-05-28T09:00:00'), 1).map((day) => format(day, 'yyyy-MM-dd')),
  ['2026-05-28'],
);

assert.deepEqual(
  getVisibleWeekDays(days, new Date('2026-05-31T09:00:00'), 3).map((day) => format(day, 'yyyy-MM-dd')),
  ['2026-05-29', '2026-05-30', '2026-05-31'],
);

assert.deepEqual(
  getVisibleWeekDays(days, new Date('2026-05-28T09:00:00'), 7).map((day) => format(day, 'yyyy-MM-dd')),
  [
    '2026-05-25',
    '2026-05-26',
    '2026-05-27',
    '2026-05-28',
    '2026-05-29',
    '2026-05-30',
    '2026-05-31',
  ],
);

assert.equal(getResponsiveWeekDayCount(390), 1);
assert.equal(getResponsiveWeekDayCount(820), 3);
assert.equal(getResponsiveWeekDayCount(1280), 7);

assert.equal(getCalendarNavigationStep('day', 1), 1);
assert.equal(getCalendarNavigationStep('week', 1), 1);
assert.equal(getCalendarNavigationStep('week', 3), 3);
assert.equal(getCalendarNavigationStep('week', 7), 7);
