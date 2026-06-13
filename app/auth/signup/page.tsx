// @ts-nocheck
import Link from 'next/link';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

export default function SignupPage() {
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
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
            Registrierung per Anfrage
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-gray-600 dark:text-slate-400">
            Neue Bookanord-Accounts werden aktuell manuell eingerichtet. So bekommst du
            direkt den passenden Plan, die richtigen Limits und eine saubere Freischaltung.
          </p>

          <div className="mt-6 grid gap-3">
            <Button asChild className="w-full">
              <a href="https://bookanord.de/#kontakt">
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                Kontaktformular öffnen
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">Zum Login</Link>
            </Button>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-slate-500">
          © {new Date().getFullYear()} BookaNord
        </p>
      </div>
    </div>
  );
}
