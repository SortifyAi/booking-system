// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  isSameDay,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WeekCalendar } from './WeekCalendar';
import { DayCalendar } from './DayCalendar';
import {
  getCalendarNavigationStep,
  getResponsiveWeekDayCount,
  getVisibleWeekDays,
} from '@/lib/calendar-responsive';

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

interface Staff {
  id: string;
  name: string;
  color: string;
}

interface CalendarContainerProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  bookings: Booking[];
  startHour?: number;
  endHour?: number;
  selectedStaff?: string;
  onStaffChange?: (staffId: string) => void;
  staffMembers?: Staff[];
  onTimeSlotClick?: (date: Date, hour: number, staffId?: string) => void;
  onBookingMove?: (
    bookingId: string,
    newStart: Date,
    newEnd: Date,
    newStaffId?: string,
  ) => void;
  onBookingClick?: (bookingId: string) => void;
}

type ViewType = 'week' | 'day';

export function CalendarContainer({
  view,
  onViewChange,
  currentDate,
  setCurrentDate,
  bookings,
  startHour = 7,
  endHour = 20,
  selectedStaff = 'all',
  onStaffChange,
  staffMembers = [],
  onTimeSlotClick,
  onBookingMove,
  onBookingClick,
}: CalendarContainerProps) {
  const [visibleWeekDaysCount, setVisibleWeekDaysCount] = useState(7);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const visibleWeekDays = getVisibleWeekDays(weekDays, currentDate, visibleWeekDaysCount);
  const navigationStep = getCalendarNavigationStep(
    view,
    view === 'week' ? visibleWeekDaysCount : 1,
  );

  useEffect(() => {
    const updateVisibleDays = () => {
      setVisibleWeekDaysCount(getResponsiveWeekDayCount(window.innerWidth));
    };

    updateVisibleDays();
    window.addEventListener('resize', updateVisibleDays);
    return () => window.removeEventListener('resize', updateVisibleDays);
  }, []);

  const handlePrevious = () => {
    setCurrentDate(addDays(currentDate, -navigationStep));
  };

  const handleNext = () => {
    setCurrentDate(addDays(currentDate, navigationStep));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeLabel = () => {
    if (view === 'week') {
      if (visibleWeekDaysCount === 1) {
        return format(currentDate, 'EEE, dd. MMM yyyy', { locale: de });
      }

      if (visibleWeekDaysCount < 7) {
        const rangeStart = visibleWeekDays[0] || currentDate;
        const rangeEnd = visibleWeekDays[visibleWeekDays.length - 1] || currentDate;
        return `${format(rangeStart, 'dd. MMM', { locale: de })} – ${format(rangeEnd, 'dd. MMM yyyy', {
          locale: de,
        })}`;
      }

      return `${format(weekStart, 'dd. MMM', { locale: de })} – ${format(weekEnd, 'dd. MMM yyyy', {
        locale: de,
      })}`;
    } else {
      return format(currentDate, 'dd. MMMM yyyy', { locale: de });
    }
  };

  const getBookingsForDayCount = (day: Date) => {
    return bookings.filter((booking) => isSameDay(day, new Date(booking.start_time))).length;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 sm:text-3xl">
              Kalender
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              Deine Buchungen in der Kalenderansicht
            </p>
          </div>
        </div>

        {/* Navigation, Staff Filter and Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Staff Filter */}
          {staffMembers.length > 0 && onStaffChange && (
            <div className="-mx-1 max-w-[calc(100vw-2rem)] overflow-x-auto px-1 sm:mx-0 sm:max-w-full">
              <div className="flex w-max gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
                <Button
                  variant={selectedStaff === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onStaffChange('all')}
                  className={`shrink-0 text-xs font-medium ${
                    selectedStaff === 'all'
                      ? ''
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  Alle
                </Button>
                {staffMembers.map((staff) => (
                  <Button
                    key={staff.id}
                    variant={selectedStaff === staff.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onStaffChange(staff.id)}
                    className={`shrink-0 text-xs font-medium ${
                      selectedStaff === staff.id
                        ? ''
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                    }`}
                    style={selectedStaff === staff.id ? { backgroundColor: staff.color } : {}}
                  >
                    {staff.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* View tabs */}
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800 sm:flex sm:w-fit sm:gap-2">
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('week')}
              className={`text-xs font-medium ${
                view === 'week'
                  ? ''
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              Woche
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('day')}
              className={`text-xs font-medium ${
                view === 'day'
                  ? ''
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              Tag
            </Button>
          </div>
        </div>

        {/* Second row: Navigation controls */}
        <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2 sm:flex sm:flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            title={navigationStep === 1 ? 'Vorheriger Tag' : 'Zurück'}
            className="text-xs"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 truncate px-1 text-center text-sm font-semibold text-gray-900 dark:text-slate-100 sm:min-w-fit sm:px-2">
            {getDateRangeLabel()}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            title={navigationStep === 1 ? 'Nächster Tag' : 'Weiter'}
            className="text-xs"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="col-span-3 text-xs font-medium sm:col-span-1"
          >
            Heute
          </Button>
        </div>

        {view === 'week' && (
          <div className="grid grid-cols-7 gap-1 lg:hidden">
            {weekDays.map((day) => {
              const active = isSameDay(day, currentDate);
              const today = isSameDay(day, new Date());
              const bookingCount = getBookingsForDayCount(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setCurrentDate(day)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-md border px-1 py-1.5 text-xs transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                      : today
                        ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-semibold uppercase leading-none">
                    {format(day, 'EEEEE', { locale: de })}
                  </span>
                  <span className="mt-1 text-base font-bold leading-none">{format(day, 'd')}</span>
                  <span
                    className={`mt-1 h-1.5 min-w-1.5 rounded-full ${
                      bookingCount > 0
                        ? active
                          ? 'bg-white'
                          : 'bg-blue-500'
                        : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Calendar view */}
      <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        {view === 'week' ? (
          <WeekCalendar
            currentDate={currentDate}
            bookings={bookings}
            startHour={startHour}
            endHour={endHour}
            onTimeSlotClick={onTimeSlotClick}
            onBookingMove={onBookingMove}
            onBookingClick={onBookingClick}
          />
        ) : (
          <DayCalendar
            currentDate={currentDate}
            bookings={bookings}
            startHour={startHour}
            endHour={endHour}
            selectedStaff={selectedStaff}
            staffMembers={staffMembers}
            onTimeSlotClick={onTimeSlotClick}
            onBookingMove={onBookingMove}
            onBookingClick={onBookingClick}
          />
        )}
      </div>
    </div>
  );
}
