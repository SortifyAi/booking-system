'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  MapPin,
  BookOpen,
  LayoutDashboard,
  LogOut,
  X,
  Briefcase,
  Users,
  Settings as SettingsIcon,
  CalendarOff,
  Award,
  ShieldBan,
  Play,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { isMockMode } from '@/lib/utils/mock';
import { Logo } from '@/components/Logo';

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  mockOnly?: boolean;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Allgemein',
    items: [
      { name: 'Übersicht', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Kalender', href: '/dashboard/calendar', icon: Calendar },
      { name: 'Buchungen', href: '/dashboard/bookings', icon: BookOpen },
    ],
  },
  {
    label: 'Verwaltung',
    items: [
      { name: 'Standorte', href: '/dashboard/locations', icon: MapPin },
      { name: 'Leistungen', href: '/dashboard/services', icon: Briefcase },
      { name: 'Personal', href: '/dashboard/resources', icon: Users },
      { name: 'Fähigkeiten', href: '/dashboard/skills', icon: Award, mockOnly: true },
      { name: 'Abwesenheiten', href: '/dashboard/blocks', icon: CalendarOff },
      { name: 'Kundensperren', href: '/dashboard/customer-blocks', icon: ShieldBan },
    ],
  },
  {
    label: 'Konto',
    items: [{ name: 'Einstellungen', href: '/dashboard/settings', icon: SettingsIcon }],
  },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-slate-800">
        <Logo size="md" />
        <button
          onClick={onClose}
          aria-label="Menü schließen"
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => !item.mockOnly || isMockMode());
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-5 last:mb-0">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-blue-600 dark:bg-blue-400" />
                      )}
                      <Icon
                        className={`h-[18px] w-[18px] transition-colors ${
                          isActive
                            ? 'text-blue-600 dark:text-blue-300'
                            : 'text-gray-500 group-hover:text-gray-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                        }`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-3 space-y-0.5 dark:border-slate-800">
        <a
          href="/book/salon-nordlicht"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors dark:text-slate-300 dark:hover:bg-slate-800/70"
        >
          <Play className="h-[18px] w-[18px] text-gray-500 dark:text-slate-400" />
          Demo-Buchung
        </a>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors dark:text-slate-300 dark:hover:bg-slate-800/70"
        >
          <LogOut className="h-[18px] w-[18px] text-gray-500 dark:text-slate-400" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
