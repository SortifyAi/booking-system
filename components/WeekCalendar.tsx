// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameDay,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Lock } from 'lucide-react';
import { getBookingDisplayParts, blockTypeLabels } from '@/lib/calendar-admin';
import {
  getBlockStyleForDay,
  getBookingTimeStyle,
  getMaximumParallelBookings,
  layoutOverlappingBookings,
} from '@/lib/calendar-layout';
import {
  filterCalendarBlocksForColumn,
  getCalendarStaffColumns,
  getCalendarTimeSlots,
  getResponsiveWeekDayCount,
  getVisibleWeekDays,
  isCalendarHourBoundary,
  type CalendarStaffColumn,
} from '@/lib/calendar-responsive';
import { useCalendarDrag, type DropTarget } from '@/lib/hooks/use-calendar-drag';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  guest_name: string;
  service: string;
  status: string;
  location_id: string;
  staff_id?: string;
  resource_id?: string;
  staff_name?: string;
  staff_color?: string;
}

interface Block {
  id: string;
  start_time: string;
  end_time: string;
  resource_id?: string | null;
  staff_id?: string | null;
  staff_name?: string;
  reason?: string | null;
  type: string;
}

interface Staff {
  id: string;
  name: string;
  color: string;
}

interface WeekCalendarProps {
  currentDate: Date;
  bookings: Booking[];
  blocks?: Block[];
  startMinute?: number;
  endMinute?: number;
  selectedStaff?: string;
  staffMembers?: Staff[];
  onTimeSlotClick?: (date: Date, hour: number, minute: number, staffId?: string) => void;
  onBookingMove?: (
    bookingId: string,
    newStart: Date,
    newEnd: Date,
    newStaffId?: string,
  ) => void;
  onBookingClick?: (bookingId: string) => void;
  onBlockClick?: (blockId: string) => void;
}

const staffColors: Record<string, string> = {
  'staff-anna': '#8B5CF6',
  'staff-marc': '#3B82F6',
  'staff-sophie': '#10B981',
};

export function WeekCalendar({
  currentDate,
  bookings,
  blocks = [],
  startMinute = 7 * 60,
  endMinute = 20 * 60,
  selectedStaff = 'all',
  staffMembers = [],
  onTimeSlotClick,
  onBookingMove,
  onBookingClick,
  onBlockClick,
}: WeekCalendarProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const timeSlots = getCalendarTimeSlots(startMinute, endMinute);
  const [visibleDaysCount, setVisibleDaysCount] = useState(7);
  const pixelsPerHour = visibleDaysCount === 1 ? 64 : 72;
  const slotHeight = pixelsPerHour / 2;
  const bodyHeight = ((endMinute - startMinute) / 60) * pixelsPerHour;
  const pixelsPerHourRef = useRef(pixelsPerHour);
  pixelsPerHourRef.current = pixelsPerHour;

  const resolvePoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    const column = element?.closest('[data-cal-column]') as HTMLElement | null;
    if (!column?.dataset.calColumn) return null;
    const rect = column.getBoundingClientRect();
    const pointerMinutes = ((clientY - rect.top) / pixelsPerHourRef.current) * 60;
    return { columnKey: column.dataset.calColumn, pointerMinutes };
  };

  const handleCommit = (bookingId: string, target: DropTarget) => {
    if (!onBookingMove) return;
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const durationMs = new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime();
    const [dateKey, targetStaffId = ''] = target.columnKey.split('::');
    const [year, month, day] = dateKey.split('-').map(Number);
    const newStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    newStart.setMinutes(startMinute);
    newStart.setMinutes(newStart.getMinutes() + target.minutesFromStart);
    const newEnd = new Date(newStart.getTime() + durationMs);
    const currentStaffId = booking.staff_id || booking.resource_id || '';
    const timeUnchanged = newStart.getTime() === new Date(booking.start_time).getTime();
    const staffUnchanged = !targetStaffId || targetStaffId === currentStaffId;
    if (timeUnchanged && staffUnchanged) return;
    onBookingMove(bookingId, newStart, newEnd, targetStaffId || undefined);
  };

  const { dragState, startDrag, draggingId } = useCalendarDrag({
    dayMinutes: endMinute - startMinute,
    snapMinutes: 30,
    resolvePoint,
    onCommit: handleCommit,
    onClick: (id) => onBookingClick?.(id),
  });

  useEffect(() => {
    const updateVisibleDays = () => {
      setVisibleDaysCount(getResponsiveWeekDayCount(window.innerWidth));
    };
    updateVisibleDays();
    window.addEventListener('resize', updateVisibleDays);
    return () => window.removeEventListener('resize', updateVisibleDays);
  }, []);

  const getBookingsForDay = (day: Date) => {
    return bookings
      .filter((booking) => isSameDay(day, new Date(booking.start_time)))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const getBlocksForDay = (day: Date) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return blocks.filter(
      (block) =>
        new Date(block.start_time) <= dayEnd && new Date(block.end_time) >= dayStart,
    );
  };

  const visibleDays = getVisibleWeekDays(days, currentDate, visibleDaysCount);
  const isStaffCapacityMode = visibleDaysCount === 1;
  const isCompactAllStaffMode = isStaffCapacityMode && selectedStaff === 'all';
  const activeDay = visibleDays[0] || currentDate;
  const activeDayBookings = getBookingsForDay(activeDay);
  const hasUnassignedBookings = activeDayBookings.some(
    (booking) => !(booking.staff_id || booking.resource_id),
  );
  const staffColumns = getCalendarStaffColumns(
    staffMembers,
    selectedStaff,
    hasUnassignedBookings,
  );

  const getBookingsForStaffColumn = (day: Date, column: CalendarStaffColumn) => {
    const dayBookings = getBookingsForDay(day);
    if (column.kind === 'aggregate') return dayBookings;
    if (column.kind === 'unassigned') {
      return dayBookings.filter((booking) => !(booking.staff_id || booking.resource_id));
    }
    return dayBookings.filter(
      (booking) => (booking.staff_id || booking.resource_id) === column.id,
    );
  };

  const getBlocksForStaffColumn = (day: Date, column: CalendarStaffColumn) => {
    if (column.kind === 'unassigned') return [];
    return filterCalendarBlocksForColumn(getBlocksForDay(day), {
      selectedStaff,
      staffId: column.kind === 'staff' ? column.id : undefined,
    });
  };

  const getBlocksForAggregateDay = (day: Date) =>
    filterCalendarBlocksForColumn(getBlocksForDay(day), {
      selectedStaff,
      hidePersonalBlocksInAggregateWeek: selectedStaff === 'all',
    });

  const calendarColumns = isStaffCapacityMode
    ? staffColumns.map((staff) => ({
        key: `${format(activeDay, 'yyyy-MM-dd')}::${staff.id}`,
        day: activeDay,
        staff,
      }))
    : visibleDays.map((day) => ({
        key: format(day, 'yyyy-MM-dd'),
        day,
        staff: null,
      }));
  const timeColumnWidth = isStaffCapacityMode ? 48 : 60;
  const calendarColumnWidths = calendarColumns.map((column) => {
    const columnBookings = column.staff
      ? getBookingsForStaffColumn(column.day, column.staff)
      : getBookingsForDay(column.day);

    if (isCompactAllStaffMode) return 58;

    const maxParallelBookings = getMaximumParallelBookings(columnBookings);
    const minimumBookingWidth = isStaffCapacityMode ? 132 : 104;
    const minimumColumnWidth = isStaffCapacityMode ? 180 : 116;
    return Math.max(
      minimumColumnWidth,
      maxParallelBookings * minimumBookingWidth + (maxParallelBookings - 1) * 4,
    );
  });
  const gridTemplateColumns = `${timeColumnWidth}px ${calendarColumnWidths.map((width) => `minmax(${width}px, 1fr)`).join(' ')}`;

  const handleSlotClick = (day: Date, hour: number, minute: number, staffId?: string) => {
    if (onTimeSlotClick) {
      onTimeSlotClick(day, hour, minute, staffId);
    }
  };

  const formatMinuteOfDay = (minuteOfDay: number) => {
    const normalizedMinute = Math.max(0, minuteOfDay);
    const hour = Math.floor(normalizedMinute / 60);
    const minute = normalizedMinute % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Day headers on desktop, compact staff headers on mobile and tablet */}
        <div className="sticky top-0 z-10 grid border-b border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800" style={{ gridTemplateColumns }}>
          <div className="sticky left-0 z-20 border-r border-gray-200 bg-gray-50 px-1 py-2 text-[10px] font-semibold text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 sm:px-2 sm:py-3 sm:text-xs">
            Zeit
          </div>
          {calendarColumns.map((column) => {
            if (column.staff) {
              return (
                <div
                  key={column.key}
                  className="min-w-0 border-r border-gray-200 px-1 py-2 text-center last:border-r-0 dark:border-slate-700 sm:px-2 sm:py-3"
                  title={column.staff.name}
                  aria-label={column.staff.name}
                >
                  <div className="flex min-w-0 items-center justify-center gap-1 sm:gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                      style={{ backgroundColor: column.staff.color }}
                    />
                    {isCompactAllStaffMode ? (
                      <>
                        <span className="text-[10px] font-bold text-gray-800 dark:text-slate-100 min-[520px]:hidden">
                          {column.staff.compactLabel}
                        </span>
                        <span className="hidden truncate text-xs font-semibold text-gray-800 dark:text-slate-100 min-[520px]:inline">
                          {column.staff.name.split(/\s+/)[0]}
                        </span>
                      </>
                    ) : (
                      <span className="truncate text-xs font-semibold text-gray-800 dark:text-slate-100 sm:text-sm">
                        {column.staff.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            const isTodayCheck = isToday(column.day);
            return (
              <div
                key={column.key}
                className={`border-r border-gray-200 px-2 py-2 text-center last:border-r-0 dark:border-slate-800 sm:py-3 ${
                  isTodayCheck
                    ? 'bg-blue-50 dark:bg-blue-500/20'
                    : ''
                }`}
              >
                <p
                  className={`text-xs font-semibold ${
                    isTodayCheck
                      ? 'text-blue-600 dark:text-blue-200'
                      : 'text-gray-600 dark:text-slate-400'
                  }`}
                >
                  {format(column.day, 'EEE', { locale: de }).toUpperCase()}
                </p>
                <p
                  className={`mt-1 text-base font-bold sm:text-sm ${
                    isTodayCheck
                      ? 'text-blue-700 dark:text-blue-100'
                      : 'text-gray-900 dark:text-slate-100'
                  }`}
                >
                  {format(column.day, 'd')}
                </p>
              </div>
            );
          })}
        </div>

        {/* Timeslots grid */}
        <div className="grid divide-x divide-gray-200 dark:divide-slate-800" style={{ gridTemplateColumns }}>
          {/* Time labels column */}
          <div className="sticky left-0 z-10 border-r border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {timeSlots.map((slot) => (
              <div
                key={slot.minuteOfDay}
                className={`relative border-b px-1 py-1 text-right sm:px-2 ${
                  isCalendarHourBoundary(slot.minuteOfDay)
                    ? 'border-gray-200 dark:border-slate-700'
                    : 'border-gray-100 dark:border-slate-800'
                }`}
                style={{ height: `${slotHeight}px` }}
              >
                <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400 sm:text-xs">
                  {slot.label}
                </p>
              </div>
            ))}
          </div>

          {calendarColumns.map((column) => {
            const columnBookings = column.staff
              ? getBookingsForStaffColumn(column.day, column.staff)
              : getBookingsForDay(column.day);
            const columnBlocks = column.staff
              ? getBlocksForStaffColumn(column.day, column.staff)
              : getBlocksForAggregateDay(column.day);
            const layout = layoutOverlappingBookings(columnBookings);
            const isDropTarget = dragState?.target?.columnKey === column.key;
            const slotStaffId = column.staff?.kind === 'staff' ? column.staff.id : undefined;

            return (
              <div
                key={column.key}
                data-cal-column={column.key}
                className="relative min-w-0 bg-white dark:bg-slate-900"
                style={{ height: `${bodyHeight}px` }}
              >
                {timeSlots.map((slot) => (
                  <button
                    key={`${column.key}-${slot.minuteOfDay}`}
                    type="button"
                    className={`block w-full cursor-pointer border-b text-left transition-colors hover:bg-blue-50 hover:ring-2 hover:ring-inset hover:ring-blue-300 dark:hover:bg-blue-500/10 dark:hover:ring-blue-600 ${
                      isCalendarHourBoundary(slot.minuteOfDay)
                        ? 'border-gray-200 dark:border-slate-700'
                        : 'border-gray-100 dark:border-slate-800'
                    }`}
                    style={{ height: `${slotHeight}px` }}
                    onClick={() =>
                      handleSlotClick(
                        column.day,
                        slot.hour,
                        slot.minute,
                        slotStaffId,
                      )
                    }
                    title={`Termin um ${slot.label} erstellen${column.staff ? ` · ${column.staff.name}` : ''}`}
                  />
                ))}

                {columnBlocks.map((block) => {
                  const style = getBlockStyleForDay(
                    block,
                    column.day,
                    startMinute,
                    endMinute,
                    pixelsPerHour,
                  );
                  if (!style) return null;
                  const label = block.reason || blockTypeLabels[block.type] || 'Blockiert';

                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => onBlockClick?.(block.id)}
                      className="absolute inset-x-0.5 z-[5] overflow-hidden rounded-md border border-slate-300 px-1 py-1 text-left text-[10px] font-medium text-slate-600 transition-colors hover:border-slate-400 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
                      style={{
                        top: `${style.top}px`,
                        height: `${style.height}px`,
                        backgroundColor: 'rgba(100,116,139,0.12)',
                        backgroundImage:
                          'repeating-linear-gradient(45deg, rgba(100,116,139,0.18) 0, rgba(100,116,139,0.18) 6px, transparent 6px, transparent 12px)',
                        cursor: 'pointer',
                      }}
                      title={`Blockiert${column.staff ? ` · ${column.staff.name}` : ''}${block.reason ? ` · ${block.reason}` : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <Lock className="h-3 w-3 shrink-0" />
                        <span className={isCompactAllStaffMode ? 'sr-only' : 'truncate'}>
                          {label}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {isDropTarget && dragState?.target && (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 z-20 flex items-start rounded-md border-2 border-dashed border-blue-500 bg-blue-500/20 px-1 py-1 text-[9px] font-semibold text-blue-700 dark:text-blue-200 sm:text-[10px]"
                    style={{
                      top: `${(dragState.target.minutesFromStart / 60) * pixelsPerHour + 6}px`,
                      height: `${Math.max(40, (dragState.durationMinutes / 60) * pixelsPerHour - 10)}px`,
                    }}
                  >
                    {formatMinuteOfDay(startMinute + dragState.target.minutesFromStart)}
                  </div>
                )}

                {columnBookings.map((booking) => {
                  const staffColor = booking.staff_color
                    || column.staff?.color
                    || staffColors[booking.staff_id]
                    || '#60A5FA';
                  const display = getBookingDisplayParts(booking);
                  const position = layout.get(booking.id) || { column: 0, columns: 1 };
                  const gap = isCompactAllStaffMode ? 2 : 4;
                  const width = `calc((100% - ${(position.columns - 1) * gap}px) / ${position.columns})`;
                  const left = `calc(${position.column} * (((100% - ${(position.columns - 1) * gap}px) / ${position.columns}) + ${gap}px))`;
                  const timeStyle = getBookingTimeStyle(
                    booking,
                    startMinute,
                    pixelsPerHour,
                    isCompactAllStaffMode ? 34 : 40,
                  );
                  const isCompactBooking = position.columns >= 3 || timeStyle.height < 52;
                  const bookingStart = new Date(booking.start_time);
                  const bookingTime = format(bookingStart, 'HH:mm');
                  const startMinutes = bookingStart.getHours() * 60
                    + bookingStart.getMinutes()
                    - startMinute;
                  const durationMinutes = Math.max(
                    15,
                    (new Date(booking.end_time).getTime() - bookingStart.getTime()) / 60000,
                  );
                  const isDragSource = draggingId === booking.id;
                  const dragTitle = isCompactAllStaffMode
                    ? `${bookingTime}${column.staff ? ` · ${column.staff.name}` : ''}`
                    : display.title;
                  const bookingTitle = isCompactAllStaffMode
                    ? `${bookingTime}${column.staff ? ` · ${column.staff.name}` : ''} · Zum Öffnen tippen`
                    : `${display.title}${display.staffLabel ? ` - ${display.staffLabel}` : ''} · Ziehen zum Verschieben`;

                  return (
                    <div
                      key={booking.id}
                      onPointerDown={(e) =>
                        startDrag(e, {
                          id: booking.id,
                          durationMinutes,
                          startMinutes,
                          title: dragTitle,
                        })
                      }
                      className={`absolute z-10 select-none overflow-hidden rounded-md border text-slate-100 shadow-sm ${
                        isCompactAllStaffMode
                          ? 'border-slate-500/60 bg-slate-800/90 px-1 py-1 text-[9px]'
                          : 'border-slate-600/70 bg-slate-800/95 px-1.5 py-1 text-xs sm:px-2 sm:py-1.5'
                      }`}
                      style={{
                        top: `${timeStyle.top}px`,
                        height: `${timeStyle.height}px`,
                        left,
                        width,
                        borderLeft: `${isCompactAllStaffMode ? 3 : 4}px solid ${staffColor}`,
                        cursor: 'grab',
                        touchAction: 'none',
                        opacity: isDragSource ? 0.4 : 1,
                        pointerEvents: draggingId ? 'none' : undefined,
                      }}
                      title={bookingTitle}
                      aria-label={bookingTitle}
                    >
                      {isCompactAllStaffMode ? (
                        <span className="font-semibold leading-none">{bookingTime}</span>
                      ) : (
                        <>
                          <div className="truncate font-semibold leading-tight">{display.title}</div>
                          {display.staffLabel && !isCompactBooking && (
                            <div className="mt-1 hidden items-center gap-1 text-[10px] font-medium text-slate-300 min-[380px]:flex">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: staffColor }}
                              />
                              <span className="truncate">{display.staffLabel}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating drag hint following the pointer */}
      {dragState && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[140%] rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow-lg dark:bg-slate-700"
          style={{ left: dragState.pointerX, top: dragState.pointerY }}
        >
          {dragState.target
            ? formatMinuteOfDay(startMinute + dragState.target.minutesFromStart)
            : dragState.title}
        </div>
      )}
    </div>
  );
}
