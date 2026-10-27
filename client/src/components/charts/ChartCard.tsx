/** Card wrapper for a chart with an accessible "View data as table" disclosure. */
import type { ReactNode } from 'react';

export function ChartCard({
  title,
  description,
  rows,
  valueLabel = 'Tickets',
  children,
}: {
  title: string;
  description?: string;
  rows: { label: string; value: number }[];
  valueLabel?: string;
  children: ReactNode;
}) {
  const empty = rows.every((r) => r.value === 0);
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold text-navy-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-600">{description}</p>}
      <div className="mt-4">
        {empty ? (
          <p className="py-10 text-center text-sm text-slate-600">No tickets to show yet.</p>
        ) : (
          children
        )}
      </div>
      {!empty && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer rounded text-slate-600 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-brand-600">
            View data as table
          </summary>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th scope="col" className="py-1 font-medium">
                  Item
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {valueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-slate-100">
                  <td className="py-1 text-slate-700">{r.label}</td>
                  <td className="py-1 text-right tabular-nums text-slate-900">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
