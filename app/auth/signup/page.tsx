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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      setLoading(false);
      return;
    }

    try {
      if (isMockMode()) {
        toast.success('Demo-Konto erstellt!');
        router.push('/dashboard');
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Konto erstellt! Überprüfen Sie Ihre E-Mail zur Bestätigung.');
      router.push('/auth/login');
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
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
            Konto erstellen
          </h1>
          <p className="mt-1.5 mb-6 text-center text-sm text-gray-600 dark:text-slate-400">
            In wenigen Sekunden startklar mit BookaNord.
          </p>

          <form onSubmit={handleSignup} className="space-y-4">
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Passwort bestätigen
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Konto wird erstellt...
                </>
              ) : isMockMode() ? (
                'Demo starten'
              ) : (
                'Registrieren'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Bereits ein Konto?{' '}
              <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-300">
                Anmelden
              </Link>
            </p>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-slate-500">
          © {new Date().getFullYear()} BookaNord
        </p>
      </div>
    </div>
  );
}
