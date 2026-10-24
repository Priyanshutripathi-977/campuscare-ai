/** Duplicate links on the ticket page. Suggestions are only shown to admins. */
import { Link } from 'react-router';
import type { TicketDetailDTO } from '@campuscare/shared';
import { StatusBadge, TagBadge } from './Badges';

export function DuplicatesPanel({
  ticket,
  isAdmin,
}: {
  ticket: TicketDetailDTO;
  isAdmin: boolean;
}) {
  const { duplicateOf, suggestions } = ticket.duplicates;
  if (!duplicateOf && suggestions.length === 0) {
    return <p className="text-sm text-slate-500">No similar open complaints found.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {duplicateOf && (
        <p>
          Linked as a duplicate of{' '}
          <Link
            to={`/tickets/${duplicateOf.ticketId}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {duplicateOf.ticketId}
          </Link>
          {duplicateOf.title && ` — ${duplicateOf.title}`}
        </p>
      )}
      {isAdmin && suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/tickets/${s.other.ticketId}`}
                  className="font-mono text-brand-700 hover:underline"
                >
                  {s.other.ticketId}
                </Link>
                <StatusBadge status={s.other.status} />
                <span className="text-xs text-slate-600">{Math.round(s.score * 100)}% match</span>
                {s.status !== 'pending' && <TagBadge>{s.status}</TagBadge>}
              </div>
              <p className="mt-1 text-slate-700">{s.other.title}</p>
            </li>
          ))}
        </ul>
      )}
      {isAdmin && suggestions.some((s) => s.status === 'pending') && (
        <Link
          to="/admin/duplicates"
          className="inline-block text-sm font-medium text-brand-700 hover:underline"
        >
          Review in the duplicates queue →
        </Link>
      )}
    </div>
  );
}
