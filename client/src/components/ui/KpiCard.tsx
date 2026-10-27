/** A headline number. When `to` is given the whole card is a link to the matching ticket list. */
import { Link } from 'react-router';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

type Accent = 'brand' | 'blue' | 'amber' | 'emerald' | 'red' | 'violet' | 'slate';

const ACCENTS: Record<Accent, string> = {
  brand: 'bg-brand-50 text-brand-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
  violet: 'bg-violet-50 text-violet-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'brand',
  to,
  emphasize = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: Accent;
  to?: string;
  /** Draws attention (red value) when the number is above zero. */
  emphasize?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${ACCENTS[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        {to && (
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600"
          />
        )}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
      <p
        className={`mt-0.5 text-3xl font-semibold tabular-nums tracking-tight ${emphasize && value !== 0 ? 'text-red-700' : 'text-navy-900'}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </>
  );
  const cls =
    'group block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-200';
  return to ? (
    <Link
      to={to}
      className={`${cls} hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-brand-600`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
