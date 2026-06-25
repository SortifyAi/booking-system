import assert from 'node:assert/strict';

const calendarResponsive = await import('./calendar-responsive.ts');

assert.equal(
  typeof calendarResponsive.getCalendarTimeRange,
  'function',
  'calendar opening-hour range helper should exist',
);
assert.equal(
  typeof calendarResponsive.getCalendarTimeSlots,
  'function',
  'half-hour slot helper should exist',
);
assert.equal(
  typeof calendarResponsive.filterCalendarBlocksForColumn,
  'function',
  'calendar block visibility helper should exist',
);
assert.equal(
  typeof calendarResponsive.isCalendarHourBoundary,
  'function',
  'calendar hour-boundary helper should exist',
);

const openingHours = [
  { day: 1, open: '09:00', close: '18:00', closed: false },
  { day: 2, open: '09:30', close: '17:30', closed: false },
  { day: 6, open: '10:00', close: '14:00', closed: false },
  { day: 0, open: '', close: '', closed: true },
];

assert.deepEqual(
  calendarResponsive.getCalendarTimeRange(
    openingHours,
    [new Date('2026-06-22T12:00:00'), new Date('2026-06-23T12:00:00')],
  ),
  { startMinute: 540, endMinute: 1080 },
);

assert.deepEqual(
  calendarResponsive.getCalendarTimeRange(
    openingHours,
    [new Date('2026-06-23T12:00:00')],
  ),
  { startMinute: 570, endMinute: 1050 },
);

assert.deepEqual(
  calendarResponsive.getCalendarTimeRange(
    openingHours,
    [new Date('2026-06-21T12:00:00')],
  ),
  { startMinute: 540, endMinute: 1080 },
  'closed days use the configured weekly envelope instead of the old hard-coded range',
);

assert.deepEqual(
  calendarResponsive.getCalendarTimeRange([], [new Date('2026-06-22T12:00:00')]),
  { startMinute: 420, endMinute: 1200 },
);

assert.deepEqual(
  calendarResponsive.getCalendarTimeSlots(570, 690, 30),
  [
    { minuteOfDay: 570, hour: 9, minute: 30, label: '09:30' },
    { minuteOfDay: 600, hour: 10, minute: 0, label: '10:00' },
    { minuteOfDay: 630, hour: 10, minute: 30, label: '10:30' },
    { minuteOfDay: 660, hour: 11, minute: 0, label: '11:00' },
  ],
);

assert.equal(calendarResponsive.isCalendarHourBoundary(540, 30), false);
assert.equal(calendarResponsive.isCalendarHourBoundary(570, 30), true);
assert.equal(calendarResponsive.isCalendarHourBoundary(600, 30), false);
assert.equal(calendarResponsive.isCalendarHourBoundary(630, 30), true);

const blocks = [
  {
    id: 'global',
    start_time: '2026-06-22T09:00:00',
    end_time: '2026-06-22T10:00:00',
    resource_id: null,
  },
  {
    id: 'lea-vacation',
    start_time: '2026-06-22T09:00:00',
    end_time: '2026-07-22T18:00:00',
    resource_id: 'lea',
  },
  {
    id: 'jonas-break',
    start_time: '2026-06-22T12:00:00',
    end_time: '2026-06-22T12:30:00',
    staff_id: 'jonas',
  },
];

assert.deepEqual(
  calendarResponsive
    .filterCalendarBlocksForColumn(blocks, {
      selectedStaff: 'all',
      hidePersonalBlocksInAggregateWeek: true,
    })
    .map((block: { id: string }) => block.id),
  ['global'],
);

assert.deepEqual(
  calendarResponsive
    .filterCalendarBlocksForColumn(blocks, {
      selectedStaff: 'all',
      staffId: 'lea',
    })
    .map((block: { id: string }) => block.id),
  ['global', 'lea-vacation'],
);

assert.deepEqual(
  calendarResponsive
    .filterCalendarBlocksForColumn(blocks, {
      selectedStaff: 'lea',
    })
    .map((block: { id: string }) => block.id),
  ['global', 'lea-vacation'],
);

console.log('calendar-view: all assertions passed');
