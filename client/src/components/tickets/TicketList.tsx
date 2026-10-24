/** Card list of tickets — used on the student "My complaints" page (works well on phones). */
import { Link } from 'react-router';
import type { TicketSummaryDTO } from '@campuscare/shared';
import { formatLocation, relativeTime } from '../../lib/format';
import { DemoBadge, PriorityBadge, StatusBadge, TagBadge } from './Badges';

export function TicketList({ tickets }: { tickets: TicketSummaryDTO[] }) {
  return (
    <ul className="space-y-3">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link
            to={`/tickets/${t.ticketId}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-brand-500 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{t.ticketId}</span>
              <StatusBadge status={t.status} />
              {t.priority && <PriorityBadge priority={t.priority} />}
              {t.overdue && <TagBadge tone="red">Overdue</TagBadge>}
              {t.isDemo && <DemoBadge />}
            </div>
            <p className="mt-2 font-semibold text-slate-900">{t.title}</p>
            <p className="mt-1 text-sm text-slate-600">
              {formatLocation(t.location)}
              {t.category && <> · {t.category}</>}
              {t.department && <> · {t.department.name}</>}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Submitted {relativeTime(t.createdAt)} · updated {relativeTime(t.updatedAt)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
