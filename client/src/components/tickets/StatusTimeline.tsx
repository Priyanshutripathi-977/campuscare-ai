import type { StatusHistoryEntry } from '@campuscare/shared';
import { formatDateTime } from '../../lib/format';
import { StatusBadge } from './Badges';

/** Vertical timeline of every status change (newest at the bottom). */
export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-5">
      {history.map((h, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden
            className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={h.to} />
            <time className="text-xs text-slate-500" dateTime={h.at}>
              {formatDateTime(h.at)}
            </time>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            {h.note ?? (h.from ? `Changed from ${h.from}` : 'Created')}
          </p>
          <p className="text-xs text-slate-500">
            by {h.by ? `${h.by.name} (${h.by.role})` : 'System'}
          </p>
        </li>
      ))}
    </ol>
  );
}
