// @ts-nocheck
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { toast } from 'sonner';
import { isMockMode } from '@/lib/utils/mock';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isMockMode()) {
        toast.success('Demo-Anmeldung aktiv');
        router.push('/dashboard');
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Detaillierte Fehlermeldungen
        const errorMessages: Record<string, string> = {
          'Invalid login credentials': 'E-Mail oder Passwort ist falsch',
          'User not found': 'Kein Konto mit dieser E-Mail-Adresse gefunden',
          'Email not confirmed': 'Bitte bestätige zuerst deine E-Mail-Adresse',
          'Invalid email': 'Bitte gib eine gültige E-Mail-Adresse ein',
        };
        
        const customMessage = errorMessages[error.message] || error.message;
        toast.error(customMessage);
        setLoading(false);
        return;
      }

      if (data.user) {
        toast.success('Erfolgreich angemeldet!');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-blue-50/40 to-indigo-50 px-4 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.10),transparent_55%),radial-gradient(circle_at_80%_90%,rgba(99,102,241,0.10),transparent_55%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white/90 p-8 shadow-xl shadow-blue-500/5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
            Willkommen zurück
          </h1>
          <p className="mt-1.5 mb-6 text-center text-sm text-gray-600 dark:text-slate-400">
            Melde dich an, um zu deinem Dashboard zu gelangen.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                E-Mail-Adresse
              </label>
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Passwort
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird angemeldet...
                </>
              ) : isMockMode() ? (
                'Demo starten'
              ) : (
                'Anmelden'
              )}
            </Button>
          </form>

        </div>
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-slate-500">
          © {new Date().getFullYear()} BookaNord
        </p>
      </div>
    </div>
  );
}
