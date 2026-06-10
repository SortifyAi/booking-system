import { isSameDay } from 'date-fns';

export type CalendarViewType = 'week' | 'day';

export function getResponsiveWeekDayCount(width: number) {
  if (width < 640) return 1;
  if (width < 1024) return 3;
  return 7;
}

export function getCalendarNavigationStep(view: CalendarViewType, visibleDaysCount: number) {
  if (view === 'day') return 1;
  return Math.max(1, visibleDaysCount);
}

export function getVisibleWeekDays(days: Date[], anchorDate: Date, visibleDaysCount: number) {
  if (visibleDaysCount >= days.length) return days;

  const anchorIndex = days.findIndex((day) => isSameDay(day, anchorDate));
  const safeAnchorIndex = anchorIndex >= 0 ? anchorIndex : 0;
  const startIndex = Math.min(
    Math.max(safeAnchorIndex, 0),
    Math.max(days.length - visibleDaysCount, 0),
  );

  return days.slice(startIndex, startIndex + visibleDaysCount);
}
