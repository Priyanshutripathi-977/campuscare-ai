/** Data table of tickets for staff/admin. Scrolls sideways on small screens. */
import { Link } from 'react-router';
import type { TicketSummaryDTO } from '@campuscare/shared';
import { formatDateTime, formatLocation, relativeTime } from '../../lib/format';
import { DemoBadge, PriorityBadge, StatusBadge, TagBadge } from './Badges';

export function TicketTable({ tickets }: { tickets: TicketSummaryDTO[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <caption className="sr-only">Tickets</caption>
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3">
              Ticket
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3">
              Priority
            </th>
            <th scope="col" className="px-4 py-3">
              Category / Dept.
            </th>
            <th scope="col" className="px-4 py-3">
              Due
            </th>
            <th scope="col" className="px-4 py-3">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="max-w-xs px-4 py-3">
                <Link
                  to={`/tickets/${t.ticketId}`}
                  className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                >
                  {t.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-mono">{t.ticketId}</span>
                  <span>· {formatLocation(t.location)}</span>
                  {t.needsReview && <TagBadge tone="violet">Needs review</TagBadge>}
                  {t.isDemo && <DemoBadge />}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={t.priority} />
              </td>
              <td className="px-4 py-3 text-slate-700">
                <div>{t.category ?? <span className="text-slate-400">Unclassified</span>}</div>
                <div className="text-xs text-slate-500">{t.department?.name ?? 'Unassigned'}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {t.dueAt ? (
                  <span
                    className={t.overdue ? 'font-medium text-red-700' : 'text-slate-700'}
                    title={formatDateTime(t.dueAt)}
                  >
                    {t.status === 'Resolved'
                      ? '—'
                      : t.overdue
                        ? `Overdue ${relativeTime(t.dueAt)}`
                        : relativeTime(t.dueAt)}
                  </span>
                ) : (
                  <span className="text-slate-400">Not set</span>
                )}
              </td>
              <td
                className="whitespace-nowrap px-4 py-3 text-slate-600"
                title={formatDateTime(t.createdAt)}
              >
                {relativeTime(t.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
