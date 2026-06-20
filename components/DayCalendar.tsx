// @ts-nocheck
'use client';

import { useRef } from 'react';
import {
  format,
  isToday,
  isSameDay,
  getHours,
  getMinutes,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Plus, Lock } from 'lucide-react';
import { getBookingDisplayParts, blockTypeLabels } from '@/lib/calendar-admin';
import {
  getBlockStyleForDay,
  getBookingTimeStyle,
  getMaximumParallelBookings,
  layoutOverlappingBookings,
} from '@/lib/calendar-layout';
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

interface DayCalendarProps {
  currentDate: Date;
  bookings: Booking[];
  blocks?: Block[];
  startHour?: number;
  endHour?: number;
  selectedStaff?: string;
  staffMembers?: Staff[];
  onTimeSlotClick?: (date: Date, hour: number, staffId?: string) => void;
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

const slotHeight = 76;

export function DayCalendar({
  currentDate,
  bookings,
  blocks = [],
  startHour = 7,
  endHour = 20,
  selectedStaff = 'all',
  staffMembers = [],
  onTimeSlotClick,
  onBookingMove,
  onBookingClick,
  onBlockClick,
}: DayCalendarProps) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const bodyHeight = (endHour - startHour) * slotHeight;

  const resolvePoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    const column = element?.closest('[data-cal-staff]') as HTMLElement | null;
    if (!column || column.dataset.calStaff == null) return null;
    const rect = column.getBoundingClientRect();
    const pointerMinutes = ((clientY - rect.top) / slotHeight) * 60;
    return { columnKey: column.dataset.calStaff, pointerMinutes };
  };

  const handleCommit = (bookingId: string, target: DropTarget) => {
    if (!onBookingMove) return;
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const bookingStart = new Date(booking.start_time);
    const durationMs = new Date(booking.end_time).getTime() - bookingStart.getTime();
    const newStart = new Date(currentDate);
    newStart.setHours(startHour, 0, 0, 0);
    newStart.setMinutes(newStart.getMinutes() + target.minutesFromStart);
    const newEnd = new Date(newStart.getTime() + durationMs);
    const newStaffId = target.columnKey || undefined;
    const currentStaffId = booking.staff_id || booking.resource_id || '';
    const timeUnchanged = newStart.getTime() === bookingStart.getTime();
    const staffUnchanged = !newStaffId || newStaffId === currentStaffId;
    if (timeUnchanged && staffUnchanged) return;
    onBookingMove(bookingId, newStart, newEnd, newStaffId);
  };

  const { dragState, startDrag, draggingId } = useCalendarDrag({
    dayMinutes: (endHour - startHour) * 60,
    resolvePoint,
    onCommit: handleCommit,
    onClick: (id) => onBookingClick?.(id),
  });

  const dayBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.start_time);
    return isSameDay(bookingDate, currentDate);
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const now = new Date();
  const currentHour = getHours(now);
  const currentMinute = getMinutes(now);
  const showNowLine = isToday(currentDate) && currentHour >= startHour && currentHour < endHour;

  const visibleStaff = selectedStaff === 'all'
    ? staffMembers
    : staffMembers.filter((staff) => staff.id === selectedStaff);
  const staffColumns = visibleStaff.length > 0
    ? visibleStaff
    : [{ id: '', name: 'Alle Termine', color: '#60A5FA' }];

  const getStaffBookings = (staffId: string) => {
    if (!staffId) return dayBookings;
    return dayBookings.filter((booking) => booking.staff_id === staffId || booking.resource_id === staffId);
  };

  const dayBlocks = blocks.filter((block) => {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    return new Date(block.start_time) <= dayEnd && new Date(block.end_time) >= dayStart;
  });

  const getStaffBlocks = (staffId: string) => {
    if (!staffId) return dayBlocks;
    return dayBlocks.filter((block) => {
      const blockStaffId = block.resource_id || block.staff_id;
      return !blockStaffId || blockStaffId === staffId;
    });
  };

  const staffColumnWidths = staffColumns.map((staff) => {
    const maxParallelBookings = getMaximumParallelBookings(getStaffBookings(staff.id));
    return Math.max(150, maxParallelBookings * 104 + (maxParallelBookings - 1) * 5);
  });
  const minimumTimelineWidth = Math.max(
    320,
    56 + staffColumnWidths.reduce((total, width) => total + width, 0),
  );
  const gridTemplateColumns = `56px ${staffColumnWidths.map((width) => `minmax(${width}px, 1fr)`).join(' ')}`;

  const handleSlotClick = (hour: number, staffId?: string) => {
    if (onTimeSlotClick) {
      onTimeSlotClick(currentDate, hour, staffId || undefined);
    }
  };

  const handleCreateButtonClick = () => {
    const defaultHour = isToday(currentDate)
      ? Math.min(Math.max(currentHour + 1, startHour), endHour - 1)
      : startHour;
    const defaultStaffId = selectedStaff !== 'all' ? selectedStaff : staffColumns[0]?.id || undefined;

    handleSlotClick(defaultHour, defaultStaffId);
  };

  const getBookingStaff = (booking: Booking) => {
    return staffMembers.find((staff) => staff.id === booking.staff_id || staff.id === booking.resource_id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 sm:text-2xl">
            {format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de })}
          </h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-slate-400 sm:text-sm">
            {dayBookings.length} Buchung{dayBookings.length !== 1 ? 'en' : ''} heute
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={handleCreateButtonClick}>
          <Plus className="h-4 w-4" />
          Neue Buchung
        </Button>
      </div>

      <div className="space-y-2 sm:hidden">
        {dayBookings.length > 0 ? (
          dayBookings.map((booking) => {
            const display = getBookingDisplayParts(booking);
            const staff = getBookingStaff(booking);
            const staffColor = booking.staff_color || staff?.color || staffColors[booking.staff_id] || '#60A5FA';

            return (
              <button
                key={booking.id}
                type="button"
                onClick={() => onBookingClick?.(booking.id)}
                className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900"
                style={{ borderLeft: `5px solid ${staffColor}` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {display.title}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: staffColor }}
                      />
                      <span className="truncate">{display.staffLabel || staff?.name || 'Ohne Mitarbeiter'}</span>
                    </div>
                    {booking.service && (
                      <p className="mt-1 truncate text-xs text-gray-500 dark:text-slate-500">
                        {booking.service}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                    {format(new Date(booking.start_time), 'HH:mm')}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            <p className="text-base font-medium">Keine Buchungen heute</p>
            <p className="mt-1 text-sm">Erstelle eine neue Buchung mit dem Button oben</p>
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:block">
        <div className="min-w-full" style={{ minWidth: `${minimumTimelineWidth}px` }}>
          <div
            className="grid border-b border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800"
            style={{ gridTemplateColumns }}
          >
            <div className="border-r border-gray-200 px-1.5 py-3 text-xs font-semibold text-gray-600 dark:border-slate-800 dark:text-slate-400 sm:px-3">
              Zeit
            </div>
            {staffColumns.map((staff) => (
              <div
                key={staff.id || 'all'}
                className="border-r border-gray-200 px-2 py-3 last:border-r-0 dark:border-slate-800 sm:px-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: staff.color }}
                  />
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {staff.name}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="relative grid" style={{ gridTemplateColumns }}>
            <div className="border-r border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-gray-200 px-1.5 py-3 text-right dark:border-slate-800 sm:px-2"
                  style={{ height: `${slotHeight}px` }}
                >
                  <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 sm:text-sm">
                    {String(hour).padStart(2, '0')}:00
                  </p>
                </div>
              ))}
            </div>

            {staffColumns.map((staff) => {
              const staffBookings = getStaffBookings(staff.id);
              const layout = layoutOverlappingBookings(staffBookings);
              const columnKey = staff.id || '';
              const isDropTarget = dragState?.target?.columnKey === columnKey;

              return (
                <div
                  key={staff.id || 'all-column'}
                  data-cal-staff={columnKey}
                  className="relative border-r border-gray-200 last:border-r-0 dark:border-slate-800"
                  style={{ height: `${bodyHeight}px` }}
                >
                  {hours.map((hour) => (
                    <button
                      key={`${staff.id || 'all'}-${hour}`}
                      type="button"
                      className="block w-full cursor-pointer border-b border-gray-100 text-left transition-colors hover:bg-blue-50 hover:ring-2 hover:ring-inset hover:ring-blue-300 dark:border-slate-800 dark:hover:bg-blue-500/10 dark:hover:ring-blue-600"
                      style={{ height: `${slotHeight}px` }}
                      onClick={() => handleSlotClick(hour, staff.id || undefined)}
                      title="Klicken um Termin zu erstellen"
                    />
                  ))}

                  {/* Blocks (gray striped bands behind bookings) */}
                  {getStaffBlocks(staff.id).map((block) => {
                    const style = getBlockStyleForDay(block, currentDate, startHour, endHour, slotHeight);
                    if (!style) return null;
                    const label = block.reason || blockTypeLabels[block.type] || 'Blockiert';

                    return (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => onBlockClick?.(block.id)}
                        className="absolute inset-x-1 z-[5] overflow-hidden rounded-md border border-slate-300 px-2 py-1 text-left text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
                        style={{
                          top: `${style.top}px`,
                          height: `${style.height}px`,
                          backgroundColor: 'rgba(100,116,139,0.12)',
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(100,116,139,0.18) 0, rgba(100,116,139,0.18) 6px, transparent 6px, transparent 12px)',
                          cursor: 'pointer',
                        }}
                        title={`Blockiert${block.reason ? ` · ${block.reason}` : ''}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{label}</span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Drop preview while dragging onto this staff column */}
                  {isDropTarget && dragState?.target && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-20 flex items-start rounded-md border-2 border-dashed border-blue-500 bg-blue-500/20 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200"
                      style={{
                        top: `${(dragState.target.minutesFromStart / 60) * slotHeight + 6}px`,
                        height: `${Math.max(48, (dragState.durationMinutes / 60) * slotHeight - 10)}px`,
                      }}
                    >
                      {String(startHour + Math.floor(dragState.target.minutesFromStart / 60)).padStart(2, '0')}
                      :
                      {String(dragState.target.minutesFromStart % 60).padStart(2, '0')}
                    </div>
                  )}

                  {staffBookings.map((booking) => {
                    const staffColor = booking.staff_color || staff.color || staffColors[booking.staff_id] || '#60A5FA';
                    const display = getBookingDisplayParts(booking);
                    const position = layout.get(booking.id) || { column: 0, columns: 1 };
                    const gap = 5;
                    const width = `calc((100% - ${(position.columns - 1) * gap}px) / ${position.columns})`;
                    const left = `calc(${position.column} * (((100% - ${(position.columns - 1) * gap}px) / ${position.columns}) + ${gap}px))`;
                    const timeStyle = getBookingTimeStyle(booking, startHour, slotHeight, 48);
                    const isCompactBooking = position.columns >= 3 || timeStyle.height < 58;
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
                        className="absolute z-10 select-none overflow-hidden rounded-md border border-slate-600/70 bg-slate-800/95 px-2 py-1.5 text-xs text-slate-100 shadow-sm sm:px-2.5 sm:py-2 sm:text-sm"
                        style={{
                          top: `${timeStyle.top}px`,
                          height: `${timeStyle.height}px`,
                          left,
                          width,
                          borderLeft: `5px solid ${staffColor}`,
                          cursor: 'grab',
                          touchAction: 'none',
                          opacity: isDragSource ? 0.4 : 1,
                          pointerEvents: draggingId ? 'none' : undefined,
                        }}
                        title={`${display.title}${display.staffLabel ? ` - ${display.staffLabel}` : ''} · Ziehen zum Verschieben`}
                      >
                        <div className="flex h-full min-h-8 flex-col justify-between gap-1">
                          <div className="min-w-0">
                            <div className="truncate font-semibold leading-tight">{display.title}</div>
                            {display.staffLabel && selectedStaff === 'all' && !isCompactBooking && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-slate-300 sm:text-xs">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: staffColor }}
                                />
                                <span className="truncate">{display.staffLabel}</span>
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-xs font-medium text-slate-400">
                            {format(new Date(booking.start_time), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {showNowLine && (
              <div
                className="pointer-events-none absolute left-[72px] right-0 z-20 h-0.5 bg-red-500 shadow-md"
                style={{
                  top: `${((currentHour - startHour) + currentMinute / 60) * slotHeight}px`,
                }}
              >
                <div className="absolute -left-2 -top-1.5 h-4 w-4 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" />
              </div>
            )}
          </div>
        </div>
      </div>

      {dayBookings.length === 0 && (
        <div className="hidden py-8 text-center text-gray-600 dark:text-slate-400 sm:block sm:py-12">
          <p className="text-lg font-medium mb-2">Keine Buchungen heute</p>
          <p className="text-sm">Erstelle eine neue Buchung mit dem Button oben</p>
        </div>
      )}

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
