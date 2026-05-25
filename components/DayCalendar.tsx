// @ts-nocheck
'use client';

import {
  format,
  isToday,
  isSameDay,
  getHours,
  getMinutes,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getBookingDisplayParts } from '@/lib/calendar-admin';

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

interface DayCalendarProps {
  currentDate: Date;
  bookings: Booking[];
  startHour?: number;
  endHour?: number;
  onTimeSlotClick?: (date: Date, hour: number) => void;
}

const staffColors: Record<string, string> = {
  'staff-anna': '#8B5CF6',
  'staff-marc': '#3B82F6',
  'staff-sophie': '#10B981',
};

const slotHeight = 88;

export function DayCalendar({
  currentDate,
  bookings,
  startHour = 7,
  endHour = 20,
  onTimeSlotClick,
}: DayCalendarProps) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const dayBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.start_time);
    return isSameDay(bookingDate, currentDate);
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const now = new Date();
  const currentHour = getHours(now);
  const currentMinute = getMinutes(now);
  const showNowLine = isToday(currentDate) && currentHour >= startHour && currentHour < endHour;

  const calculateBookingPosition = (booking: Booking) => {
    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);
    const startHourOfDay = getHours(startTime);
    const startMinOfDay = getMinutes(startTime);
    const startOffsetHours = startHourOfDay - startHour + startMinOfDay / 60;
    const durationHours = Math.max(
      0.5,
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    );

    return {
      top: `${startOffsetHours * slotHeight + 6}px`,
      height: `${Math.max(54, durationHours * slotHeight - 12)}px`,
    };
  };

  const handleSlotClick = (hour: number) => {
    if (onTimeSlotClick) {
      onTimeSlotClick(currentDate, hour);
    }
  };

  const handleCreateButtonClick = () => {
    const defaultHour = isToday(currentDate)
      ? Math.min(Math.max(currentHour + 1, startHour), endHour - 1)
      : startHour;

    handleSlotClick(defaultHour);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 sm:text-2xl">
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

      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative" style={{ height: `${(endHour - startHour) * slotHeight}px` }}>
          <div className="absolute bottom-0 left-0 top-0 w-16 border-r border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800 sm:w-20">
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-b border-gray-200 px-2 py-3 text-right dark:border-slate-800"
                style={{ height: `${slotHeight}px` }}
              >
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 sm:text-sm">
                  {String(hour).padStart(2, '0')}:00
                </p>
              </div>
            ))}
          </div>

          <div className="relative ml-16 sm:ml-20">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-500/10"
                style={{ height: `${slotHeight}px` }}
                onClick={() => handleSlotClick(hour)}
                title="Klicken um Termin zu erstellen"
              >
                {showNowLine && currentHour === hour && (
                  <div className="absolute left-0 right-0 z-20 h-0.5 bg-red-500">
                    <div className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            ))}

            {dayBookings.map((booking) => {
              const staffColor = booking.staff_color || staffColors[booking.staff_id] || '#60A5FA';
              const display = getBookingDisplayParts(booking);

              return (
                <div
                  key={booking.id}
                  className="absolute left-2 right-2 z-10 overflow-hidden rounded-md border border-slate-600/70 bg-slate-800/95 px-3 py-2 text-sm text-slate-100 shadow-sm"
                  style={{
                    ...calculateBookingPosition(booking),
                    borderLeft: `5px solid ${staffColor}`,
                  }}
                  title={`${booking.guest_name} - ${booking.service}`}
                >
                  <div className="flex h-full min-h-10 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-tight">{display.title}</div>
                      {display.staffLabel && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
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

            {showNowLine && (
              <div
                className="absolute left-0 right-0 z-20 h-0.5 bg-red-500 shadow-md"
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
        <div className="text-center py-12 text-gray-600 dark:text-slate-400">
          <p className="text-lg font-medium mb-2">Keine Buchungen heute</p>
          <p className="text-sm">Erstelle eine neue Buchung mit dem Button oben</p>
        </div>
      )}
    </div>
  );
}
