// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameDay,
} from 'date-fns';
import { de } from 'date-fns/locale';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  guest_name: string;
  service: string;
  status: string;
  location_id: string;
  staff_id?: string;
}

interface WeekCalendarProps {
  currentDate: Date;
  bookings: Booking[];
  startHour?: number;
  endHour?: number;
  onTimeSlotClick?: (date: Date, hour: number) => void;
}

const getServiceColor = (service: string) => {
  switch (service?.toLowerCase()) {
    case 'haircut':
      return 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700';
    case 'massage':
      return 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700';
    case 'konsultation':
      return 'bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700';
    default:
      return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600';
  }
};

const getServiceTextColor = (service: string) => {
  switch (service?.toLowerCase()) {
    case 'haircut':
      return 'text-blue-800 dark:text-blue-100';
    case 'massage':
      return 'text-green-800 dark:text-green-100';
    case 'konsultation':
      return 'text-purple-800 dark:text-purple-100';
    default:
      return 'text-gray-800 dark:text-gray-100';
  }
};

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
}: WeekCalendarProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const getBookingsForDayAndHour = (day: Date, hour: number) => {
    return bookings.filter((booking) => {
      const startTime = new Date(booking.start_time);
      const endTime = new Date(booking.end_time);

      return (
        isSameDay(day, startTime) &&
        startTime.getHours() === hour
      );
    });
  };

  const calculateBookingStyle = (booking: Booking) => {
    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);
    const hourRange = endHour - startHour;
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const heightPercent = (durationHours / hourRange) * 100;
    
    return {
      height: `${Math.max(8, heightPercent)}%`,
      minHeight: '32px',
    };
  };

  // Responsive: mobile 1 day, tablet 3 days, desktop 7 days
  const [visibleDaysCount, setVisibleDaysCount] = useState(7);
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const updateVisibleDays = () => {
      const width = window.innerWidth;
      if (width < 640) setVisibleDaysCount(1);       // mobile
      else if (width < 1024) setVisibleDaysCount(3); // tablet
      else setVisibleDaysCount(7);                   // desktop
    };
    updateVisibleDays();
    window.addEventListener('resize', updateVisibleDays);
    return () => window.removeEventListener('resize', updateVisibleDays);
  }, []);

  // Start from today (or current week day) instead of always from Monday
  const today = new Date();
  const todayIndex = days.findIndex(day => isSameDay(day, today));
  const startIndex = todayIndex >= 0 && todayIndex < visibleDaysCount ? todayIndex : 0;
  const visibleDays = days.slice(startIndex, startIndex + visibleDaysCount);

  const handleSlotClick = (day: Date, hour: number) => {
    if (onTimeSlotClick) {
      onTimeSlotClick(day, hour);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {/* Header with days */}
        <div className="grid sticky top-0 z-10 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)` }}>
          <div className="border-r border-gray-200 dark:border-slate-800 px-2 py-3 text-xs font-semibold text-gray-600 dark:text-slate-400">
            Zeit
          </div>
          {visibleDays.map((day, idx) => {
            const isTodayCheck = isToday(day);
            return (
              <div
                key={day.toString()}
                className={`px-2 py-3 text-center border-r border-gray-200 dark:border-slate-800 last:border-r-0 ${
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
                  className={`text-sm font-bold mt-1 ${
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
        <div className="grid divide-x divide-gray-200 dark:divide-slate-800" style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)` }}>
          {/* Time labels column */}
          <div className="bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative border-b border-gray-100 dark:border-slate-800 px-2 py-2 text-right"
                style={{ height: '48px' }}
              >
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {String(hour).padStart(2, '0')}:00
                </p>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {visibleDays.map((day, dayIdx) => (
            <div
              key={day.toString()}
              className="relative bg-white dark:bg-slate-900"
            >
              {hours.map((hour) => {
                const dayBookings = getBookingsForDayAndHour(day, hour);
                const isClickable = dayBookings.length === 0;
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`relative border-b border-gray-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer p-1 ${
                      isClickable ? 'hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-600' : ''
                    }`}
                    style={{ height: '48px' }}
                    onClick={() => isClickable && handleSlotClick(day, hour)}
                    title={isClickable ? 'Klicken um Termin zu erstellen' : undefined}
                  >
                    {dayBookings.map((booking, idx) => (
                      <div
                        key={booking.id}
                        className={`absolute left-1 right-1 rounded border p-1 text-xs font-medium shadow-sm overflow-hidden ${getServiceColor(
                          booking.service
                        )} ${getServiceTextColor(booking.service)}`}
                        style={calculateBookingStyle(booking)}
                        title={`${booking.guest_name} - ${booking.service}`}
                      >
                        <div className="truncate font-bold">{booking.guest_name}</div>
                        <div className="truncate text-xs opacity-75">{booking.service}</div>
                        {booking.staff_id && (
                          <div 
                            className="truncate text-xs mt-0.5"
                            style={{ color: staffColors[booking.staff_id] || '#6B7280' }}
                          >
                            {booking.staff_id.replace('staff-', '').charAt(0).toUpperCase() + booking.staff_id.replace('staff-', '').slice(1)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-slate-400 p-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900 rounded border border-blue-300 dark:border-blue-700"></div>
          <span>Haircut</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900 rounded border border-green-300 dark:border-green-700"></div>
          <span>Massage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-100 dark:bg-purple-900 rounded border border-purple-300 dark:border-purple-700"></div>
          <span>Konsultation</span>
        </div>
      </div>
    </div>
  );
}