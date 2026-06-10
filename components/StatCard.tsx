import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down';
  trendLabel?: string;
  tone?: Tone;
}

const toneStyles: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
};

export function StatCard({ label, value, icon, trend, trendLabel, tone = 'blue' }: StatCardProps) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-gray-900 dark:text-slate-100">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div
          className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            trend === 'up'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          }`}
        >
          {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trendLabel ?? 'Trend'}
        </div>
      )}
    </div>
  );
}
