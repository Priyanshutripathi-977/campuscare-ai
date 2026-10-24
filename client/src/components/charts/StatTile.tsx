/** A headline number (KPI). Optional link turns it into a shortcut to the filtered list. */
import { Link } from 'react-router';

export function StatTile({
  label,
  value,
  hint,
  to,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  tone?: 'default' | 'attention';
}) {
  const body = (
    <>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${tone === 'attention' && value !== 0 ? 'text-red-700' : 'text-slate-900'}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-4 shadow-xs';
  return to ? (
    <Link
      to={to}
      className={`${cls} transition hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-600`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
