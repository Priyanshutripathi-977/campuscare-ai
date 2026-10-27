/**
 * Department performance as an accessible table: workload, overdue tickets, average time to
 * resolve, and a thin bar showing what share of each department's tickets is resolved.
 * All values come from /api/admin/stats (departmentPerformance).
 */
import type { StatsDTO } from '@campuscare/shared';

export function DepartmentPerformance({ rows }: { rows: StatsDTO['departmentPerformance'] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-600">
        No tickets have been assigned to a department yet.
      </p>
    );
  }
  return (
    // Focusable + named so keyboard users can scroll it sideways on small screens.
    <div
      className="-mx-2 overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-brand-600"
      tabIndex={0}
      role="region"
      aria-label="Department performance table"
    >
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Department performance</caption>
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <th scope="col" className="px-2 pb-2">
              Department
            </th>
            <th scope="col" className="px-2 pb-2 text-right">
              Open
            </th>
            <th scope="col" className="px-2 pb-2 text-right">
              Overdue
            </th>
            <th scope="col" className="px-2 pb-2 text-right">
              Resolved
            </th>
            <th scope="col" className="px-2 pb-2">
              Resolved share
            </th>
            <th scope="col" className="px-2 pb-2 text-right">
              Avg. time to resolve
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const total = r.open + r.resolved;
            const share = total ? Math.round((r.resolved / total) * 100) : 0;
            return (
              <tr key={r.name} className="transition-colors hover:bg-slate-50">
                <th scope="row" className="px-2 py-2.5 text-left font-medium text-navy-900">
                  {r.name}
                </th>
                <td className="px-2 py-2.5 text-right tabular-nums text-navy-900">{r.open}</td>
                <td
                  className={`px-2 py-2.5 text-right tabular-nums ${r.overdue ? 'font-semibold text-red-700' : 'text-slate-600'}`}
                >
                  {r.overdue}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-navy-900">{r.resolved}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      aria-hidden
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        className="h-full rounded-full bg-[#2a78d6] transition-[width] duration-700"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-slate-700">{share}%</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                  {r.avgResolutionHours === null ? '—' : `${r.avgResolutionHours} h`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
