// @ts-nocheck
'use client';

import { use, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  format,
  isSameDay,
  startOfDay,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { formatTimeInTimeZone } from '@/lib/timezone';
import {
  AlertCircle,
  Briefcase,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PublicCalendarResource {
  id: string;
  name: string;
}

interface PublicCalendarBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  resourceId: string | null;
  customerName: string;
  serviceName: string | null;
  staffName: string | null;
}

interface PublicCalendarPayload {
  share: {
    name: string;
    organizationName: string | null;
    organizationLogoUrl: string | null;
  };
  resources: PublicCalendarResource[];
  bookings: PublicCalendarBooking[];
}

const statusLabels: Record<string, string> = {
  pending: 'Offen',
  confirmed: 'Bestätigt',
  cancelled: 'Storniert',
  completed: 'Erledigt',
  no_show: 'Nicht erschienen',
};

function formatTimeRange(booking: PublicCalendarBooking) {
  // Render the label in the salon's timezone so it matches everywhere else,
  // independent of the viewer's device timezone.
  return `${formatTimeInTimeZone(booking.startTime)} - ${formatTimeInTimeZone(booking.endTime)}`;
}

export default function PublicCalendarSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('all');
  const [view, setView] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      setLoading(true);
      setNotFound(false);
      try {
        const response = await fetch(`/api/public/calendar-shares/${token}`);
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 404) setNotFound(true);
          else throw new Error(payload.error || 'Kalender konnte nicht geladen werden');
          return;
        }
        if (active) setData(payload);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCalendar();
    return () => {
      active = false;
    };
  }, [token]);

  const visibleDates = useMemo(() => {
    if (view === 'day') return [currentDate];
    return Array.from({ length: 7 }, (_, index) => addDays(currentDate, index));
  }, [currentDate, view]);

  const filteredBookings = useMemo(() => {
    const bookings = data?.bookings || [];
    return bookings.filter((booking) => {
      const matchesStaff = selectedResourceId === 'all' || booking.resourceId === selectedResourceId;
      const matchesDate = visibleDates.some((day) => isSameDay(new Date(booking.startTime), day));
      return matchesStaff && matchesDate;
    });
  }, [data?.bookings, selectedResourceId, visibleDates]);

  const bookingsByDate = useMemo(() => {
    return visibleDates.map((day) => ({
      day,
      bookings: filteredBookings.filter((booking) => isSameDay(new Date(booking.startTime), day)),
    }));
  }, [filteredBookings, visibleDates]);

  const moveDate = (direction: -1 | 1) => {
    setCurrentDate((date) => addDays(date, direction * (view === 'week' ? 7 : 1)));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CalendarIcon className="mx-auto h-8 w-8 animate-pulse text-blue-600 dark:text-blue-300" />
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">Kalender wird geladen...</p>
        </div>
      </main>
    );
  }

  if (notFound || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <AlertCircle className="mx-auto h-10 w-10 text-gray-400 dark:text-slate-500" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-slate-100">
            Link ungültig oder deaktiviert
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 dark:bg-slate-950 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <header className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {data.share.organizationLogoUrl ? (
                <img
                  src={data.share.organizationLogoUrl}
                  alt=""
                  className="h-12 w-12 rounded-md border border-gray-200 bg-white object-contain p-1 dark:border-slate-700"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                  <CalendarIcon className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-500 dark:text-slate-400">
                  {data.share.organizationName || 'Kalender'}
                </p>
                <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {data.share.name}
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-slate-800 sm:w-fit">
              <Button
                variant={view === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('day')}
              >
                Tag
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('week')}
              >
                Woche
              </Button>
            </div>
          </div>
        </header>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 max-w-[calc(100vw-2rem)] overflow-x-auto px-1 lg:mx-0 lg:max-w-full">
              <div className="flex w-max gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
                <Button
                  variant={selectedResourceId === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedResourceId('all')}
                >
                  Alle
                </Button>
                {data.resources.map((resource) => (
                  <Button
                    key={resource.id}
                    variant={selectedResourceId === resource.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedResourceId(resource.id)}
                  >
                    {resource.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={() => moveDate(-1)} title="Zurück">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 truncate px-2 text-center text-sm font-semibold text-gray-900 dark:text-slate-100">
                {view === 'day'
                  ? format(currentDate, 'EEEE, dd. MMMM yyyy', { locale: de })
                  : `${format(visibleDates[0], 'dd. MMM', { locale: de })} - ${format(
                      visibleDates[visibleDates.length - 1],
                      'dd. MMM yyyy',
                      { locale: de }
                    )}`}
              </div>
              <Button variant="outline" size="sm" onClick={() => moveDate(1)} title="Weiter">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(startOfDay(new Date()))}
                className="col-span-3 sm:col-span-1"
              >
                Heute
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 dark:text-slate-500" />
              <p className="mt-3 text-sm font-medium text-gray-700 dark:text-slate-300">
                Keine kommenden Termine
              </p>
            </div>
          ) : (
            bookingsByDate.map(({ day, bookings }) => (
              <div
                key={day.toISOString()}
                className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="border-b border-gray-200 px-4 py-3 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {format(day, 'EEEE, dd. MMMM', { locale: de })}
                  </h2>
                </div>
                {bookings.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-gray-500 dark:text-slate-400">
                    Keine Termine
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {bookings.map((booking) => (
                      <article key={booking.id} className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTimeRange(booking)}
                              </span>
                              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                                {statusLabels[booking.status] || booking.status}
                              </span>
                            </div>
                            <h3 className="mt-2 truncate text-base font-semibold text-gray-900 dark:text-slate-100">
                              {booking.customerName}
                            </h3>
                            <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600 dark:text-slate-400 sm:flex-row sm:flex-wrap sm:gap-4">
                              {booking.serviceName && (
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <Briefcase className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{booking.serviceName}</span>
                                </span>
                              )}
                              {booking.staffName && (
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <User className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{booking.staffName}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
