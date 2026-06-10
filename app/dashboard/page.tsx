// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StatCard } from '@/components/StatCard';
import { Calendar, MapPin, Users, TrendingUp, Briefcase, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { BookingTrendsChart } from '@/components/BookingTrendsChart';
import { isMockMode } from '@/lib/utils/mock';
import { mockBookings, mockLocations, mockOfferings, mockResources, mockBookingTrends } from '@/lib/mock-data';
import { format } from 'date-fns';

interface DashboardStats {
  totalBookings: number;
  totalLocations: number;
  upcomingBookings: number;
  bookingRate: number;
  totalOfferings: number;
  totalResources: number;
}

interface BookingRecord {
  start_time: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    totalLocations: 0,
    upcomingBookings: 0,
    bookingRate: 0,
    totalOfferings: 0,
    totalResources: 0,
  });
  const [trendData, setTrendData] = useState(mockBookingTrends);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        if (isMockMode()) {
          const upcomingCount = mockBookings.filter((booking) => new Date(booking.start_time) > new Date()).length;
          setStats({
            totalBookings: mockBookings.length,
            totalLocations: mockLocations.length,
            upcomingBookings: upcomingCount,
            bookingRate: mockLocations.length ? Math.round(mockBookings.length / mockLocations.length) : 0,
            totalOfferings: mockOfferings.length,
            totalResources: mockResources.length,
          });
          setTrendData(mockBookingTrends);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          toast.error('Benutzerinformationen konnten nicht geladen werden');
          return;
        }

        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('*');

        if (bookingsError) throw bookingsError;

        const { data: locations, error: locationsError } = await supabase
          .from('locations')
          .select('*');

        if (locationsError) throw locationsError;

        const { data: offerings, error: offeringsError } = await supabase
          .from('offerings')
          .select('id');

        if (offeringsError) throw offeringsError;

        const { data: resources, error: resourcesError } = await supabase
          .from('resources')
          .select('id');

        if (resourcesError) throw resourcesError;

        const today = new Date();
        const upcomingCount = bookings?.filter((booking: BookingRecord) => {
          return new Date(booking.start_time) > today;
        }).length || 0;

        setStats({
          totalBookings: bookings?.length || 0,
          totalLocations: locations?.length || 0,
          upcomingBookings: upcomingCount,
          bookingRate: locations?.length ? Math.round((bookings?.length || 0) / locations.length) : 0,
          totalOfferings: offerings?.length || 0,
          totalResources: resources?.length || 0,
        });

        const trendMap = new Map<string, number>();
        (bookings || []).forEach((booking: BookingRecord) => {
          const key = format(new Date(booking.start_time), 'yyyy-MM-dd');
          trendMap.set(key, (trendMap.get(key) || 0) + 1);
        });

        const computedTrend = mockBookingTrends.map((point) => ({
          date: point.date,
          value: trendMap.get(format(point.date, 'yyyy-MM-dd')) || 0,
        }));
        setTrendData(computedTrend);
      } catch (error) {
        toast.error('Dashboard-Statistiken konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [supabase]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
          Übersicht
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Willkommen zurück bei BookaNord – hier ist deine aktuelle Auslastung.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm animate-pulse dark:border-slate-800 dark:bg-slate-900">
              <div className="h-4 w-24 bg-gray-200 rounded mb-4 dark:bg-slate-700" />
              <div className="h-8 w-16 bg-gray-200 rounded dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Gesamte Buchungen"
            value={stats.totalBookings}
            icon={<Calendar className="h-5 w-5" />}
            tone="blue"
          />
          <StatCard
            label="Standorte"
            value={stats.totalLocations}
            icon={<MapPin className="h-5 w-5" />}
            tone="violet"
          />
          <StatCard
            label="Anstehend"
            value={stats.upcomingBookings}
            icon={<Users className="h-5 w-5" />}
            tone="amber"
          />
          <StatCard
            label="Ø pro Standort"
            value={stats.bookingRate}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="emerald"
          />
          <StatCard
            label="Leistungen"
            value={stats.totalOfferings}
            icon={<Briefcase className="h-5 w-5" />}
            tone="rose"
          />
          <StatCard
            label="Ressourcen"
            value={stats.totalResources}
            icon={<UserCheck className="h-5 w-5" />}
            tone="slate"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <BookingTrendsChart data={trendData} loading={loading} />
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Letzte Aktivität</h2>
          <p className="mt-4 text-sm text-gray-600 dark:text-slate-400">
            Noch keine Aktivität. Erstelle Buchungen und Standorte, um Updates hier zu sehen.
          </p>
        </div>
      </div>
    </div>
  );
}
