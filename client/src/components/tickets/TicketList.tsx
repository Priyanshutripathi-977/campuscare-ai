/** Card list of tickets — used on the student pages (works well on phones). */
import { Link } from 'react-router';
import { Building2, ChevronRight, Clock } from 'lucide-react';
import type { TicketSummaryDTO } from '@campuscare/shared';
import { formatLocation, relativeTime } from '../../lib/format';
import { DemoBadge, PriorityBadge, StatusBadge, TagBadge } from './Badges';
import { TicketProgress } from './TicketProgress';

export function TicketList({
  tickets,
  showProgress = true,
}: {
  tickets: TicketSummaryDTO[];
  showProgress?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {tickets.map((t, i) => (
        <li
          key={t.id}
          className="animate-slide-up"
          style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
        >
          <Link
            to={`/tickets/${t.ticketId}`}
            className="group block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-slate-600">{t.ticketId}</span>
              <StatusBadge status={t.status} />
              {t.priority && <PriorityBadge priority={t.priority} />}
              {t.overdue && <TagBadge tone="red">Overdue</TagBadge>}
              {t.isDemo && <DemoBadge />}
              <ChevronRight
                aria-hidden
                className="ml-auto h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
              />
            </div>
            <p className="mt-2 font-semibold text-navy-900">{t.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span>{formatLocation(t.location)}</span>
              {t.category && <span>· {t.category}</span>}
              <span className="inline-flex items-center gap-1">
                <Building2 aria-hidden className="h-3.5 w-3.5" />
                {t.department?.name ?? 'Department not assigned yet'}
              </span>
            </p>
            {showProgress && (
              <div className="mt-4">
                <TicketProgress status={t.status} compact />
              </div>
            )}
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-600">
              <Clock aria-hidden className="h-3.5 w-3.5" />
              Submitted {relativeTime(t.createdAt)} · updated {relativeTime(t.updatedAt)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
