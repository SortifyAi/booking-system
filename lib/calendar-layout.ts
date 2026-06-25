export interface CalendarLayoutBooking {
  id: string;
  start_time: string;
  end_time: string;
}

export interface CalendarLayoutPosition {
  column: number;
  columns: number;
}

export interface CalendarTimeStyle {
  top: number;
  height: number;
}

const getTime = (value: string) => new Date(value).getTime();

const overlaps = (first: CalendarLayoutBooking, second: CalendarLayoutBooking) => {
  return getTime(first.start_time) < getTime(second.end_time)
    && getTime(second.start_time) < getTime(first.end_time);
};

const sortBookings = (bookings: CalendarLayoutBooking[]) => {
  return [...bookings].sort((first, second) => {
    const startDiff = getTime(first.start_time) - getTime(second.start_time);
    if (startDiff !== 0) return startDiff;

    const endDiff = getTime(first.end_time) - getTime(second.end_time);
    if (endDiff !== 0) return endDiff;

    return first.id.localeCompare(second.id);
  });
};

export function getMaximumParallelBookings(bookings: CalendarLayoutBooking[]) {
  const timeline = bookings.flatMap((booking) => [
    { time: getTime(booking.start_time), delta: 1 },
    { time: getTime(booking.end_time), delta: -1 },
  ]);

  timeline.sort((first, second) => {
    const timeDiff = first.time - second.time;
    if (timeDiff !== 0) return timeDiff;

    return first.delta - second.delta;
  });

  let activeBookings = 0;
  let maximumParallelBookings = 0;

  for (const point of timeline) {
    activeBookings += point.delta;
    maximumParallelBookings = Math.max(maximumParallelBookings, activeBookings);
  }

  return Math.max(1, maximumParallelBookings);
}

export function layoutOverlappingBookings(
  bookings: CalendarLayoutBooking[],
): Map<string, CalendarLayoutPosition> {
  const groups: CalendarLayoutBooking[][] = [];

  for (const booking of sortBookings(bookings)) {
    const matchingIndexes = groups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.some((item) => overlaps(item, booking)))
      .map(({ index }) => index);

    if (matchingIndexes.length === 0) {
      groups.push([booking]);
      continue;
    }

    const targetIndex = matchingIndexes[0];
    groups[targetIndex].push(booking);

    for (const mergeIndex of matchingIndexes.slice(1).reverse()) {
      groups[targetIndex].push(...groups[mergeIndex]);
      groups.splice(mergeIndex, 1);
    }
  }

  const positions = new Map<string, CalendarLayoutPosition>();

  for (const group of groups) {
    const sortedGroup = sortBookings(group);
    const columnEndTimes: number[] = [];
    const columnByBookingId = new Map<string, number>();

    for (const booking of sortedGroup) {
      const start = getTime(booking.start_time);
      const end = getTime(booking.end_time);
      const reusableColumn = columnEndTimes.findIndex((columnEnd) => columnEnd <= start);
      const column = reusableColumn >= 0 ? reusableColumn : columnEndTimes.length;

      columnEndTimes[column] = end;
      columnByBookingId.set(booking.id, column);
    }

    const columns = Math.max(1, columnEndTimes.length);
    for (const booking of sortedGroup) {
      positions.set(booking.id, {
        column: columnByBookingId.get(booking.id) ?? 0,
        columns,
      });
    }
  }

  return positions;
}

/**
 * Position style for a block (vacation/break/etc.) on a single day column.
 * The block is clamped to the visible [startMinute, endMinute] window of that day,
 * so multi-day or out-of-hours blocks render as a band covering the visible part.
 * Returns null when the block does not intersect the visible window at all.
 */
export function getBlockStyleForDay(
  block: { start_time: string; end_time: string },
  day: Date,
  startMinute: number,
  endMinute: number,
  pixelsPerHour: number,
): CalendarTimeStyle | null {
  const windowStart = new Date(day);
  windowStart.setHours(
    Math.floor(startMinute / 60),
    startMinute % 60,
    0,
    0,
  );
  const windowEnd = new Date(day);
  windowEnd.setHours(
    Math.floor(endMinute / 60),
    endMinute % 60,
    0,
    0,
  );

  const blockStart = new Date(block.start_time);
  const blockEnd = new Date(block.end_time);

  const visibleStart = blockStart > windowStart ? blockStart : windowStart;
  const visibleEnd = blockEnd < windowEnd ? blockEnd : windowEnd;

  if (visibleEnd.getTime() <= visibleStart.getTime()) return null;

  const startOffsetMinutes = (visibleStart.getTime() - windowStart.getTime()) / 60000;
  const durationMinutes = (visibleEnd.getTime() - visibleStart.getTime()) / 60000;

  return {
    top: (startOffsetMinutes / 60) * pixelsPerHour,
    height: Math.max(8, (durationMinutes / 60) * pixelsPerHour),
  };
}

export function getBookingTimeStyle(
  booking: CalendarLayoutBooking,
  startMinute: number,
  pixelsPerHour: number,
  minHeight: number,
): CalendarTimeStyle {
  const startTime = new Date(booking.start_time);
  const endTime = new Date(booking.end_time);
  const startOffsetMinutes = startTime.getHours() * 60 + startTime.getMinutes() - startMinute;
  const durationMinutes = Math.max(15, (endTime.getTime() - startTime.getTime()) / 60000);

  return {
    top: Math.max(0, (startOffsetMinutes / 60) * pixelsPerHour + 6),
    height: Math.max(minHeight, (durationMinutes / 60) * pixelsPerHour - 10),
  };
}
