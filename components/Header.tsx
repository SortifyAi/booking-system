'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Menu, ExternalLink } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUI } from '@/lib/store/ui-context';
import { isMockMode } from '@/lib/utils/mock';
import { mockUser, mockOrganizations } from '@/lib/mock-data';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const supabase = createClient();
  const { setSidebarOpen, sidebarOpen } = useUI();

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
        const { data } = await supabase
          .from('user_organizations')
          .select('organizations(slug)')
          .eq('user_id', user.id)
          .single() as { data: { organizations: { slug: string } | null } | null };
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
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-950">
      <button
        onClick={handleMenuClick}
        className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Menu className="h-6 w-6" />
      </button>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Dashboard</h2>

      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-slate-400">
        <ThemeToggle />
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
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">{userEmail}</span>
          <span className="sm:hidden truncate">{userEmail?.split('@')[0]}</span>
        </div>
      </div>
    </div>
  );
}
