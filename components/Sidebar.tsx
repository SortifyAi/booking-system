'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, MapPin, BookOpen, LayoutDashboard, LogOut, X, Briefcase, Users, Settings as SettingsIcon, CalendarOff, Award } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { isMockMode } from '@/lib/utils/mock';

const navigation = [
  { name: 'Übersicht', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Standorte', href: '/dashboard/locations', icon: MapPin },
  { name: 'Buchungen', href: '/dashboard/bookings', icon: BookOpen },
  { name: 'Kalender', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Leistungen', href: '/dashboard/services', icon: Briefcase },
  { name: 'Personal', href: '/dashboard/resources', icon: Users },
  { name: 'Fähigkeiten', href: '/dashboard/skills', icon: Award, mockOnly: true },
  { name: 'Abwesenheiten', href: '/dashboard/blocks', icon: CalendarOff },
  { name: 'Einstellungen', href: '/dashboard/settings', icon: SettingsIcon },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const visibleNavigation = navigation.filter((item) => !item.mockOnly || isMockMode());

  const handleLogout = async () => {
    try {
      if (!isMockMode()) {
        await supabase.auth.signOut();
      }
      toast.success('Erfolgreich abgemeldet');
      router.push('/auth/login');
      router.refresh();
    } catch (error) {
      toast.error('Abmeldung fehlgeschlagen');
    }
  };

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-slate-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Buchung</h1>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4 dark:border-slate-800">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <LogOut className="h-5 w-5" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
