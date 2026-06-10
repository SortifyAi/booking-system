'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Menu, ExternalLink } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUI } from '@/lib/store/ui-context';
import { isMockMode } from '@/lib/utils/mock';
import { mockUser, mockOrganizations } from '@/lib/mock-data';

interface HeaderProps {
  onMenuClick?: () => void;
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Übersicht',
  '/dashboard/calendar': 'Kalender',
  '/dashboard/bookings': 'Buchungen',
  '/dashboard/locations': 'Standorte',
  '/dashboard/services': 'Leistungen',
  '/dashboard/resources': 'Personal',
  '/dashboard/skills': 'Fähigkeiten',
  '/dashboard/blocks': 'Abwesenheiten',
  '/dashboard/settings': 'Einstellungen',
};

function resolvePageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.keys(pageTitles)
    .filter((key) => key !== '/dashboard' && pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? pageTitles[match] : 'Dashboard';
}

function initialsFor(email: string | null): string {
  if (!email) return '··';
  const localPart = email.split('@')[0] ?? '';
  const segments = localPart.split(/[._-]/).filter(Boolean);
  if (segments.length >= 2) {
    return (segments[0][0] + segments[1][0]).toUpperCase();
  }
  return localPart.slice(0, 2).toUpperCase();
}

export function Header({ onMenuClick }: HeaderProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const supabase = createClient();
  const { setSidebarOpen, sidebarOpen } = useUI();
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);

  useEffect(() => {
    const fetchUser = async () => {
      if (isMockMode()) {
        setUserEmail(mockUser.email);
        setOrgSlug(mockOrganizations[0]?.slug ?? null);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);

      if (user) {
        const { data } = (await supabase
          .from('user_organizations')
          .select('organizations(slug)')
          .eq('user_id', user.id)
          .single()) as { data: { organizations: { slug: string } | null } | null };
        const slug = data?.organizations?.slug ?? null;
        setOrgSlug(slug);
      }
    };

    fetchUser();
  }, [supabase]);

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
      return;
    }
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={handleMenuClick}
          aria-label="Menü öffnen"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="hidden text-[11px] font-medium uppercase tracking-wider text-gray-400 sm:block dark:text-slate-500">
            BookaNord
          </p>
          <h2 className="truncate text-base font-semibold text-gray-900 sm:text-lg dark:text-slate-100">
            {pageTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {orgSlug && (
          <a
            href={`/book/${orgSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Buchungsseite</span>
          </a>
        )}
        <ThemeToggle />
        <div
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2.5 dark:border-slate-800 dark:bg-slate-900 sm:pr-3"
          title={userEmail ?? undefined}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-semibold text-white">
            {initialsFor(userEmail)}
          </div>
          <span className="hidden max-w-[180px] truncate text-xs font-medium text-gray-700 sm:inline dark:text-slate-300">
            {userEmail}
          </span>
        </div>
      </div>
    </div>
  );
}
