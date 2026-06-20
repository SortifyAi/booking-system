import { isSameDay } from 'date-fns';

export type CalendarViewType = 'week' | 'day';

export interface CalendarStaffMember {
  id: string;
  name: string;
  color: string;
}

export interface CalendarStaffColumn extends CalendarStaffMember {
  kind: 'staff' | 'unassigned' | 'aggregate';
  compactLabel: string;
}

export function getCompactStaffLabel(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) || 'MA').toUpperCase();
}

export function getCalendarStaffColumns(
  staffMembers: CalendarStaffMember[],
  selectedStaff: string,
  includeUnassigned: boolean,
): CalendarStaffColumn[] {
  const visibleStaff = selectedStaff === 'all'
    ? staffMembers
    : staffMembers.filter((staff) => staff.id === selectedStaff);
  const columns: CalendarStaffColumn[] = visibleStaff.map((staff) => ({
    ...staff,
    kind: 'staff',
    compactLabel: getCompactStaffLabel(staff.name),
  }));

  if (selectedStaff === 'all' && includeUnassigned) {
    columns.push({
      id: '',
      name: 'Ohne Zuordnung',
      color: '#94A3B8',
      kind: 'unassigned',
      compactLabel: '?',
    });
  }

  return columns.length > 0
    ? columns
    : [{
        id: '',
        name: 'Alle Termine',
        color: '#60A5FA',
        kind: 'aggregate',
        compactLabel: 'AL',
      }];
}

export function getResponsiveWeekDayCount(width: number) {
  return width < 1024 ? 1 : 7;
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
