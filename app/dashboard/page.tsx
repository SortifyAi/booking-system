// @ts-nocheck
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StatCard } from '@/components/StatCard';
import { QuickBookingDialog } from '@/components/QuickBookingDialog';
import { BookingTrendsChart } from '@/components/BookingTrendsChart';
import { Button } from '@/components/ui/button';
import {
  CalendarClock,
  CalendarPlus,
  Clock,
  Coffee,
  Euro,
  Inbox,
  Plus,
  Sparkles,
  Sun,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { isMockMode } from '@/lib/utils/mock';
import {
  mockBookings,
  mockLocations,
  mockOfferings,
  mockResources,
  mockStaff,
  mockBookingTrends,
} from '@/lib/mock-data';

const MIN_GAP_MINUTES = 20;

function formatEuro(cents) {
  if (cents == null) return '–';
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function formatHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
}

function humanizeUntil(date) {
  const diff = Math.round((date.getTime() - Date.now()) / 60000);
  if (diff <= 0) return 'jetzt';
  if (diff < 60) return `in ${diff} Min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m === 0 ? `in ${h} Std` : `in ${h} Std ${m} Min`;
}

const statusBadge = {
  confirmed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  no_show: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
};

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [quickOpen, setQuickOpen] = useState(false);

  const [locations, setLocations] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [resources, setResources] = useState([]);
  const [windowBookings, setWindowBookings] = useState([]); // heute + morgen
  const [pending, setPending] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [trendData, setTrendData] = useState(mockBookingTrends);
  const [now, setNow] = useState(() => new Date());

  // Uhr für "Jetzt/Als Nächstes" minütlich aktualisieren
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfTomorrow = new Date(startOfToday.getTime() + 2 * 86400000 - 1);

      if (isMockMode()) {
        setLocations(mockLocations);
        setOfferings(mockOfferings);
        setResources(mockResources);
        const win = mockBookings.filter((b) => {
          const s = new Date(b.start_time);
          return s >= startOfToday && s <= endOfTomorrow;
        });
        setWindowBookings(win);
        setPending(
          mockBookings.filter((b) => b.status === 'pending' && new Date(b.start_time) >= today),
        );
        setCancellations([]);
        setTrendData(mockBookingTrends);
        return;
      }

      const [
        { data: locationsData },
        { data: offeringsData },
        { data: resourcesData },
        { data: windowData },
        { data: pendingData },
        { data: cancelledData },
        { data: trendBookings },
      ] = await Promise.all([
        supabase.from('locations').select('id, name, organization_id, timezone, settings'),
        supabase
          .from('offerings')
          .select('id, name, duration_minutes, price_cents, color, location_id, is_active'),
        supabase.from('resources').select('id, name, type, location_id, is_active'),
        supabase
          .from('bookings')
          .select('*')
          .gte('start_time', startOfToday.toISOString())
          .lte('start_time', endOfTomorrow.toISOString())
          .order('start_time', { ascending: true }),
        supabase
          .from('bookings')
          .select('*')
          .eq('status', 'pending')
          .gte('start_time', today.toISOString())
          .order('start_time', { ascending: true })
          .limit(15),
        supabase
          .from('bookings')
          .select('*')
          .eq('status', 'cancelled')
          .gte('updated_at', new Date(today.getTime() - 2 * 86400000).toISOString())
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('bookings')
          .select('start_time')
          .gte('start_time', new Date(today.getTime() - 14 * 86400000).toISOString()),
      ]);

      setLocations(locationsData || []);
      setOfferings(offeringsData || []);
      setResources(resourcesData || []);
      setWindowBookings(windowData || []);
      setPending(pendingData || []);
      setCancellations(cancelledData || []);

      // Trend: Buchungen je Tag über die mockBookingTrends-Achse
      const trendMap = new Map();
      (trendBookings || []).forEach((b) => {
        const key = format(new Date(b.start_time), 'yyyy-MM-dd');
        trendMap.set(key, (trendMap.get(key) || 0) + 1);
      });
      setTrendData(
        mockBookingTrends.map((p) => ({
          date: p.date,
          value: trendMap.get(format(p.date, 'yyyy-MM-dd')) || 0,
        })),
      );
    } catch (error) {
      console.error('Dashboard load failed:', error);
      toast.error('Dashboard konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lookups
  const offeringsById = useMemo(() => {
    const m = new Map();
    offerings.forEach((o) => m.set(o.id, o));
    return m;
  }, [offerings]);

  const resourcesById = useMemo(() => {
    const m = new Map();
    resources.forEach((r) => m.set(r.id, r));
    mockStaff.forEach((s) => m.set(s.id, s)); // Mock-Fallback
    return m;
  }, [resources]);

  // Buchung normalisieren (echte + Mock-Form)
  const normalize = useCallback(
    (b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const offering = b.offering_id ? offeringsById.get(b.offering_id) : null;
      const resource = b.resource_id
        ? resourcesById.get(b.resource_id)
        : b.staff_id
          ? resourcesById.get(b.staff_id)
          : null;
      const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
      return {
        id: b.id,
        start,
        end,
        status: b.status,
        name: b.customer_name || b.guest_name || 'Gast',
        phone: b.customer_phone,
        serviceName: offering?.name || b.service || null,
        priceCents: offering?.price_cents ?? null,
        staffName: resource?.name || null,
        durationMin,
      };
    },
    [offeringsById, resourcesById],
  );

  const todayKey = format(now, 'yyyy-MM-dd');
  const tomorrowKey = format(new Date(now.getTime() + 86400000), 'yyyy-MM-dd');

  const todays = useMemo(
    () =>
      windowBookings
        .map(normalize)
        .filter((b) => format(b.start, 'yyyy-MM-dd') === todayKey && b.status !== 'cancelled')
        .sort((a, b) => a.start - b.start),
    [windowBookings, normalize, todayKey],
  );

  const tomorrows = useMemo(
    () =>
      windowBookings
        .map(normalize)
        .filter((b) => format(b.start, 'yyyy-MM-dd') === tomorrowKey && b.status !== 'cancelled')
        .sort((a, b) => a.start - b.start),
    [windowBookings, normalize, tomorrowKey],
  );

  const currentBooking = useMemo(
    () => todays.find((b) => b.start <= now && b.end > now),
    [todays, now],
  );
  const nextBooking = useMemo(() => todays.find((b) => b.start > now), [todays, now]);

  const stats = useMemo(() => {
    const bookedMin = todays.reduce((sum, b) => sum + b.durationMin, 0);
    const revenue = todays.reduce((sum, b) => sum + (b.priceCents || 0), 0);
    return {
      count: todays.length,
      bookedMin,
      revenue,
      pending: pending.length,
    };
  }, [todays, pending]);

  // Tagesfahrplan inkl. freier Lücken
  const scheduleItems = useMemo(() => {
    const items = [];
    const upcoming = todays.filter((b) => b.end > now);
    // führende Lücke (jetzt bis zum nächsten Termin)
    if (!currentBooking && nextBooking) {
      const gap = Math.round((nextBooking.start.getTime() - now.getTime()) / 60000);
      if (gap >= MIN_GAP_MINUTES) {
        items.push({ type: 'gap', key: 'lead', from: now, to: nextBooking.start, minutes: gap });
      }
    }
    todays.forEach((b, i) => {
      items.push({ type: 'booking', key: b.id, booking: b });
      const next = todays[i + 1];
      if (next) {
        const gap = Math.round((next.start.getTime() - b.end.getTime()) / 60000);
        if (gap >= MIN_GAP_MINUTES) {
          items.push({ type: 'gap', key: `gap-${b.id}`, from: b.end, to: next.start, minutes: gap });
        }
      }
    });
    return items;
  }, [todays, now, currentBooking, nextBooking]);

  const confirmBooking = async (id) => {
    if (isMockMode()) {
      setPending((p) => p.filter((b) => b.id !== id));
      toast.success('Termin bestätigt');
      return;
    }
    const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
    if (error) {
      toast.error('Konnte nicht bestätigt werden');
      return;
    }
    toast.success('Termin bestätigt');
    fetchData();
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100 sm:text-3xl">
            {format(now, "EEEE, d. MMMM", { locale: de })}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Dein Tag auf einen Blick
          </p>
        </div>
        <Button onClick={() => setQuickOpen(true)} size="lg">
          <Plus className="mr-1.5 h-5 w-5" /> Schnell-Termin
        </Button>
      </div>

      {/* Hero: Jetzt / Als Nächstes */}
      <HeroNext
        loading={loading}
        currentBooking={currentBooking}
        nextBooking={nextBooking}
        tomorrows={tomorrows}
        onQuickAdd={() => setQuickOpen(true)}
      />

      {/* Kennzahlen, die heute zählen */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Termine heute"
          value={loading ? '–' : stats.count}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Gebucht heute"
          value={loading ? '–' : formatHours(stats.bookedMin)}
          icon={<Clock className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          label="Umsatz geplant"
          value={loading ? '–' : formatEuro(stats.revenue)}
          icon={<Euro className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Zu bestätigen"
          value={loading ? '–' : stats.pending}
          icon={<Inbox className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Tagesfahrplan */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
                <Sun className="h-5 w-5 text-amber-500" /> Heute
              </h2>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {todays.length} {todays.length === 1 ? 'Termin' : 'Termine'}
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : todays.length === 0 ? (
              <EmptyDay onQuickAdd={() => setQuickOpen(true)} />
            ) : (
              <ol className="space-y-2">
                {scheduleItems.map((item) =>
                  item.type === 'gap' ? (
                    <li
                      key={item.key}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400"
                    >
                      <Coffee className="h-4 w-4 flex-shrink-0" />
                      <span className="tabular-nums">
                        {format(item.from, 'HH:mm')}–{format(item.to, 'HH:mm')}
                      </span>
                      <span>frei · {formatHours(item.minutes)}</span>
                      <button
                        onClick={() => setQuickOpen(true)}
                        className="ml-auto text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                      >
                        + füllen
                      </button>
                    </li>
                  ) : (
                    <ScheduleRow
                      key={item.key}
                      b={item.booking}
                      isCurrent={currentBooking?.id === item.booking.id}
                      isNext={!currentBooking && nextBooking?.id === item.booking.id}
                    />
                  ),
                )}
              </ol>
            )}
          </div>
        </div>

        {/* Rechte Spalte: Posteingang + Morgen */}
        <div className="space-y-4 sm:space-y-6">
          {/* Posteingang */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
              <Inbox className="h-5 w-5 text-blue-500" /> Posteingang
            </h2>

            {loading ? (
              <div className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
            ) : pending.length === 0 && cancellations.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Alles erledigt – nichts offen.
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map((raw) => {
                  const b = normalize(raw);
                  return (
                    <li
                      key={b.id}
                      className="rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                            {b.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {format(b.start, 'EE d.M. · HH:mm', { locale: de })}
                            {b.serviceName ? ` · ${b.serviceName}` : ''}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => confirmBooking(b.id)}>
                          Bestätigen
                        </Button>
                      </div>
                    </li>
                  );
                })}
                {cancellations.map((raw) => {
                  const b = normalize(raw);
                  return (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-500 dark:text-slate-400"
                    >
                      <XCircle className="h-4 w-4 flex-shrink-0 text-rose-400" />
                      <span className="truncate">
                        Storniert: {b.name} · {format(b.start, 'd.M. HH:mm', { locale: de })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Morgen */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
              <CalendarPlus className="h-5 w-5 text-violet-500" /> Morgen
            </h2>
            {loading ? (
              <div className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
            ) : tomorrows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Noch keine Termine für morgen.</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-gray-600 dark:text-slate-300">
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {tomorrows.length} Termine
                  </span>{' '}
                  · Start {format(tomorrows[0].start, 'HH:mm')} Uhr
                </p>
                <ul className="space-y-1">
                  {tomorrows.slice(0, 4).map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300"
                    >
                      <span className="tabular-nums font-medium text-gray-900 dark:text-slate-100">
                        {format(b.start, 'HH:mm')}
                      </span>
                      <span className="truncate">{b.name}</span>
                      {b.serviceName && (
                        <span className="truncate text-gray-400">· {b.serviceName}</span>
                      )}
                    </li>
                  ))}
                  {tomorrows.length > 4 && (
                    <li className="text-xs text-gray-400">+ {tomorrows.length - 4} weitere</li>
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Verlauf (sekundär) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
          Buchungen je Tag
        </h2>
        <BookingTrendsChart data={trendData} loading={loading} />
      </div>

      <QuickBookingDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        locations={locations}
        offerings={offerings}
        resources={resources}
        onCreated={fetchData}
      />
    </div>
  );
}

function HeroNext({ loading, currentBooking, nextBooking, tomorrows, onQuickAdd }) {
  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800" />;
  }

  const active = currentBooking || nextBooking;

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900 sm:p-6">
      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              {currentBooking ? 'Gerade im Termin' : `Als Nächstes · ${humanizeUntil(nextBooking.start)}`}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
              <span className="tabular-nums">{format(active.start, 'HH:mm')}</span> {active.name}
            </p>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-300">
              {active.serviceName || 'Termin'}
              {active.durationMin ? ` · ${formatHours(active.durationMin)}` : ''}
              {active.staffName ? ` · ${active.staffName}` : ''}
            </p>
          </div>
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            <CalendarClock className="h-7 w-7" />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-slate-100">
              <Sparkles className="h-5 w-5 text-amber-500" /> Keine weiteren Termine heute
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              {tomorrows.length > 0
                ? `Morgen geht es um ${format(tomorrows[0].start, 'HH:mm')} Uhr weiter (${tomorrows.length} Termine).`
                : 'Auch morgen ist noch frei – Zeit für Laufkundschaft.'}
            </p>
          </div>
          <Button onClick={onQuickAdd} variant="outline">
            <Plus className="mr-1.5 h-4 w-4" /> Termin eintragen
          </Button>
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ b, isCurrent, isNext }) {
  return (
    <li
      className={`flex items-stretch gap-3 rounded-lg border p-3 transition ${
        isCurrent
          ? 'border-blue-300 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-500/5'
          : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <div className="flex flex-col items-center justify-center rounded-md bg-gray-50 px-2.5 text-center dark:bg-slate-800">
        <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-slate-100">
          {format(b.start, 'HH:mm')}
        </span>
        <span className="text-[11px] text-gray-400">{format(b.end, 'HH:mm')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-gray-900 dark:text-slate-100">{b.name}</p>
          {isCurrent && (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
              läuft
            </span>
          )}
          {isNext && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              als nächstes
            </span>
          )}
        </div>
        <p className="truncate text-sm text-gray-500 dark:text-slate-400">
          {b.serviceName || 'Termin'}
          {b.staffName ? ` · ${b.staffName}` : ''}
          {b.phone ? ` · ${b.phone}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-end justify-center gap-1">
        {b.priceCents != null && (
          <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-slate-200">
            {formatEuro(b.priceCents)}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[b.status] || statusBadge.completed}`}>
          {b.status === 'confirmed'
            ? 'Bestätigt'
            : b.status === 'pending'
              ? 'Offen'
              : b.status === 'completed'
                ? 'Fertig'
                : b.status === 'cancelled'
                  ? 'Storniert'
                  : b.status === 'no_show'
                    ? 'Nicht erschienen'
                    : b.status}
        </span>
      </div>
    </li>
  );
}

function EmptyDay({ onQuickAdd }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-10 text-center dark:border-slate-700">
      <Coffee className="h-8 w-8 text-gray-300 dark:text-slate-600" />
      <p className="mt-2 font-medium text-gray-700 dark:text-slate-200">Heute noch nichts eingetragen</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Trage einen Termin ein oder genieß die ruhige Minute.
      </p>
      <Button onClick={onQuickAdd} className="mt-4" variant="outline">
        <Plus className="mr-1.5 h-4 w-4" /> Schnell-Termin
      </Button>
    </div>
  );
}
