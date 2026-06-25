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

export interface CalendarOpeningHours {
  day: number;
  open: string;
  close: string;
  closed?: boolean;
}

export interface CalendarTimeRange {
  startMinute: number;
  endMinute: number;
}

export interface CalendarTimeSlot {
  minuteOfDay: number;
  hour: number;
  minute: number;
  label: string;
}

interface CalendarBlockWithStaff {
  resource_id?: string | null;
  staff_id?: string | null;
}

const DEFAULT_CALENDAR_TIME_RANGE: CalendarTimeRange = {
  startMinute: 7 * 60,
  endMinute: 20 * 60,
};

const parseTime = (value: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const getOpeningHourRanges = (openingHours: CalendarOpeningHours[]) => {
  return openingHours.flatMap((hours) => {
    if (hours.closed) return [];
    const open = parseTime(hours.open);
    const close = parseTime(hours.close);
    if (open == null || close == null || close <= open) return [];
    return [{ ...hours, openMinute: open, closeMinute: close }];
  });
};

const getEnvelope = (
  ranges: Array<{ openMinute: number; closeMinute: number }>,
): CalendarTimeRange | null => {
  if (ranges.length === 0) return null;
  const startMinute = Math.floor(
    Math.min(...ranges.map((hours) => hours.openMinute)) / 30,
  ) * 30;
  const endMinute = Math.ceil(
    Math.max(...ranges.map((hours) => hours.closeMinute)) / 30,
  ) * 30;
  return endMinute > startMinute ? { startMinute, endMinute } : null;
};

export function getCalendarTimeRange(
  openingHours: CalendarOpeningHours[],
  visibleDays: Date[],
  fallback: CalendarTimeRange = DEFAULT_CALENDAR_TIME_RANGE,
): CalendarTimeRange {
  const configuredRanges = getOpeningHourRanges(openingHours);
  if (configuredRanges.length === 0) return fallback;

  const visibleDayNumbers = new Set(visibleDays.map((day) => day.getDay()));
  const visibleRanges = configuredRanges.filter((hours) =>
    visibleDayNumbers.has(hours.day),
  );

  return getEnvelope(visibleRanges)
    || getEnvelope(configuredRanges)
    || fallback;
}

export function getCalendarTimeSlots(
  startMinute: number,
  endMinute: number,
  slotMinutes = 30,
): CalendarTimeSlot[] {
  if (slotMinutes <= 0 || endMinute <= startMinute) return [];

  return Array.from(
    { length: Math.ceil((endMinute - startMinute) / slotMinutes) },
    (_, index) => startMinute + index * slotMinutes,
  )
    .filter((minuteOfDay) => minuteOfDay < endMinute)
    .map((minuteOfDay) => {
      const hour = Math.floor(minuteOfDay / 60);
      const minute = minuteOfDay % 60;
      return {
        minuteOfDay,
        hour,
        minute,
        label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      };
    });
}

export function isCalendarHourBoundary(
  minuteOfDay: number,
  slotMinutes = 30,
) {
  return (minuteOfDay + slotMinutes) % 60 === 0;
}

export function filterCalendarBlocksForColumn<T extends CalendarBlockWithStaff>(
  blocks: T[],
  options: {
    selectedStaff: string;
    staffId?: string;
    hidePersonalBlocksInAggregateWeek?: boolean;
  },
): T[] {
  const { selectedStaff, staffId, hidePersonalBlocksInAggregateWeek = false } = options;

  return blocks.filter((block) => {
    const blockStaffId = block.resource_id || block.staff_id || '';
    if (!blockStaffId) return true;
    if (hidePersonalBlocksInAggregateWeek && selectedStaff === 'all') return false;
    if (staffId != null) return blockStaffId === staffId;
    if (selectedStaff !== 'all') return blockStaffId === selectedStaff;
    return true;
  });
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
