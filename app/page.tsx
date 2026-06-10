// @ts-nocheck
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isMockMode } from '@/lib/utils/mock';
import { Logo } from '@/components/Logo';

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      if (isMockMode()) {
        router.push('/dashboard');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/auth/login');
      }
    };

    checkAuth();
  }, [router, supabase]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-blue-50/40 to-indigo-50 px-6 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.10),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.10),transparent_55%)]"
      />
      <div className="relative flex flex-col items-center text-center">
        <Logo size="lg" className="animate-pulse" />
        <p className="mt-3 max-w-md text-sm leading-6 text-gray-600 dark:text-slate-400">
          Dein Buchungssystem wird vorbereitet…
        </p>
        <div className="mt-8 flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Weiterleitung
        </div>
      </div>
    </main>
  );
}
