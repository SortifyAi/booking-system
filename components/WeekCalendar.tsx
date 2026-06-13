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
import { getBookingDisplayParts } from '@/lib/calendar-admin';
import {
  getBookingTimeStyle,
  getMaximumParallelBookings,
  layoutOverlappingBookings,
} from '@/lib/calendar-layout';
import {
  getResponsiveWeekDayCount,
  getVisibleWeekDays,
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
  staff_name?: string;
  staff_color?: string;
}

interface WeekCalendarProps {
  currentDate: Date;
  bookings: Booking[];
  startHour?: number;
  endHour?: number;
  onTimeSlotClick?: (date: Date, hour: number, staffId?: string) => void;
  onBookingMove?: (bookingId: string, newStart: Date, newEnd: Date) => void;
  onBookingClick?: (bookingId: string) => void;
}

const staffColors: Record<string, string> = {
  'staff-anna': '#8B5CF6',
  'staff-marc': '#3B82F6',
  'staff-sophie': '#10B981',
};

export function WeekCalendar({
  currentDate,
  bookings,
  startHour = 7,
  endHour = 20,
  onTimeSlotClick,
  onBookingMove,
  onBookingClick,
}: WeekCalendarProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const [visibleDaysCount, setVisibleDaysCount] = useState(7);
  const slotHeight = visibleDaysCount === 1 ? 64 : 72;
  const bodyHeight = (endHour - startHour) * slotHeight;
  const slotHeightRef = useRef(slotHeight);
  slotHeightRef.current = slotHeight;

  const resolvePoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    const column = element?.closest('[data-cal-day]') as HTMLElement | null;
    if (!column?.dataset.calDay) return null;
    const rect = column.getBoundingClientRect();
    const pointerMinutes = ((clientY - rect.top) / slotHeightRef.current) * 60;
    return { columnKey: column.dataset.calDay, pointerMinutes };
  };

  const handleCommit = (bookingId: string, target: DropTarget) => {
    if (!onBookingMove) return;
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const durationMs = new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime();
    const [year, month, day] = target.columnKey.split('-').map(Number);
    const newStart = new Date(year, month - 1, day, startHour, 0, 0, 0);
    newStart.setMinutes(newStart.getMinutes() + target.minutesFromStart);
    const newEnd = new Date(newStart.getTime() + durationMs);
    if (newStart.getTime() === new Date(booking.start_time).getTime()) return;
    onBookingMove(bookingId, newStart, newEnd);
  };

  const { dragState, startDrag, draggingId } = useCalendarDrag({
    dayMinutes: (endHour - startHour) * 60,
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

  const visibleDays = getVisibleWeekDays(days, currentDate, visibleDaysCount);
  const timeColumnWidth = visibleDaysCount === 1 ? 52 : 60;
  const dayColumnWidths = visibleDays.map((day) => {
    const maxParallelBookings = getMaximumParallelBookings(getBookingsForDay(day));
    const minimumBookingWidth = visibleDaysCount === 1 ? 132 : 104;
    const minimumDayWidth = visibleDaysCount === 1 ? 180 : 116;

    return Math.max(
      minimumDayWidth,
      maxParallelBookings * minimumBookingWidth + (maxParallelBookings - 1) * 4,
    );
  });
  const gridTemplateColumns = `${timeColumnWidth}px ${dayColumnWidths.map((width) => `minmax(${width}px, 1fr)`).join(' ')}`;

  const handleSlotClick = (day: Date, hour: number) => {
    if (onTimeSlotClick) {
      onTimeSlotClick(day, hour);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Header with days */}
        <div className="sticky top-0 z-10 grid border-b border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800" style={{ gridTemplateColumns }}>
          <div className="border-r border-gray-200 px-1.5 py-2 text-xs font-semibold text-gray-600 dark:border-slate-800 dark:text-slate-400 sm:px-2 sm:py-3">
            Zeit
          </div>
          {visibleDays.map((day, idx) => {
            const isTodayCheck = isToday(day);
            return (
              <div
                key={day.toString()}
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
                  {format(day, 'EEE', { locale: de }).toUpperCase()}
                </p>
                <p
                  className={`mt-1 text-base font-bold sm:text-sm ${
                    isTodayCheck
                      ? 'text-blue-700 dark:text-blue-100'
                      : 'text-gray-900 dark:text-slate-100'
                  }`}
                >
                  {format(day, 'd')}
                </p>
              </div>
            );
          })}
        </div>

        {/* Timeslots grid */}
        <div className="grid divide-x divide-gray-200 dark:divide-slate-800" style={{ gridTemplateColumns }}>
          {/* Time labels column */}
          <div className="bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="relative border-b border-gray-100 px-1.5 py-2 text-right dark:border-slate-800 sm:px-2"
                  style={{ height: `${slotHeight}px` }}
                >
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {String(hour).padStart(2, '0')}:00
                </p>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {visibleDays.map((day) => {
            const dayBookings = getBookingsForDay(day);
            const layout = layoutOverlappingBookings(dayBookings);
            const dayKey = format(day, 'yyyy-MM-dd');
            const isDropTarget = dragState?.target?.columnKey === dayKey;

            return (
              <div
                key={day.toString()}
                data-cal-day={dayKey}
                className="relative min-w-0 bg-white dark:bg-slate-900"
                style={{ height: `${bodyHeight}px` }}
              >
                {hours.map((hour) => (
                  <button
                    key={`${day}-${hour}`}
                    type="button"
                    className="block w-full cursor-pointer border-b border-gray-100 text-left transition-colors hover:bg-blue-50 hover:ring-2 hover:ring-inset hover:ring-blue-300 dark:border-slate-800 dark:hover:bg-blue-500/10 dark:hover:ring-blue-600"
                    style={{ height: `${slotHeight}px` }}
                    onClick={() => handleSlotClick(day, hour)}
                    title="Klicken um Termin zu erstellen"
                  />
                ))}

                {/* Drop preview while dragging onto this day */}
                {isDropTarget && dragState?.target && (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 z-20 flex items-start rounded-md border-2 border-dashed border-blue-500 bg-blue-500/20 px-1.5 py-1 text-[10px] font-semibold text-blue-700 dark:text-blue-200"
                    style={{
                      top: `${(dragState.target.minutesFromStart / 60) * slotHeight + 6}px`,
                      height: `${Math.max(40, (dragState.durationMinutes / 60) * slotHeight - 10)}px`,
                    }}
                  >
                    {String(startHour + Math.floor(dragState.target.minutesFromStart / 60)).padStart(2, '0')}
                    :
                    {String(dragState.target.minutesFromStart % 60).padStart(2, '0')}
                  </div>
                )}

                {dayBookings.map((booking) => {
                  const staffColor = booking.staff_color || staffColors[booking.staff_id] || '#60A5FA';
                  const display = getBookingDisplayParts(booking);
                  const position = layout.get(booking.id) || { column: 0, columns: 1 };
                  const gap = 4;
                  const width = `calc((100% - ${(position.columns - 1) * gap}px) / ${position.columns})`;
                  const left = `calc(${position.column} * (((100% - ${(position.columns - 1) * gap}px) / ${position.columns}) + ${gap}px))`;
                  const timeStyle = getBookingTimeStyle(booking, startHour, slotHeight, 40);
                  const isCompactBooking = position.columns >= 3 || timeStyle.height < 52;
                  const bookingStart = new Date(booking.start_time);
                  const startMinutes = (bookingStart.getHours() - startHour) * 60 + bookingStart.getMinutes();
                  const durationMinutes = Math.max(
                    15,
                    (new Date(booking.end_time).getTime() - bookingStart.getTime()) / 60000,
                  );
                  const isDragSource = draggingId === booking.id;

                  return (
                    <div
                      key={booking.id}
                      onPointerDown={(e) =>
                        startDrag(e, {
                          id: booking.id,
                          durationMinutes,
                          startMinutes,
                          title: display.title,
                        })
                      }
                      className="absolute z-10 select-none overflow-hidden rounded-md border border-slate-600/70 bg-slate-800/95 px-1.5 py-1 text-xs text-slate-100 shadow-sm sm:px-2 sm:py-1.5"
                      style={{
                        top: `${timeStyle.top}px`,
                        height: `${timeStyle.height}px`,
                        left,
                        width,
                        borderLeft: `4px solid ${staffColor}`,
                        cursor: 'grab',
                        touchAction: 'none',
                        opacity: isDragSource ? 0.4 : 1,
                        pointerEvents: draggingId ? 'none' : undefined,
                      }}
                      title={`${display.title}${display.staffLabel ? ` - ${display.staffLabel}` : ''} · Ziehen zum Verschieben`}
                    >
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
            ? `${String(startHour + Math.floor(dragState.target.minutesFromStart / 60)).padStart(2, '0')}:${String(dragState.target.minutesFromStart % 60).padStart(2, '0')}`
            : dragState.title}
        </div>
      )}
    </div>
  );
}
