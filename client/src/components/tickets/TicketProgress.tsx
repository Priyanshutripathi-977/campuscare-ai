/**
 * Visual progress tracker: Submitted → Under Review → Assigned → In Progress → Resolved.
 * Built from the ticket's REAL status history (dates come from the history entries).
 * A reopened ticket is shown with a clear "Reopened" marker after the resolved step.
 */
import { Check, RotateCcw } from 'lucide-react';
import type { Status, StatusHistoryEntry } from '@campuscare/shared';
import { formatDate } from '../../lib/format';

const STEPS: Status[] = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved'];

/** Index of the furthest step reached for the CURRENT status. */
function currentIndex(status: Status) {
  if (status === 'Reopened') return 3; // back to "being worked on"
  return STEPS.indexOf(status);
}

export function TicketProgress({
  status,
  history,
  compact = false,
}: {
  status: Status;
  history?: StatusHistoryEntry[];
  compact?: boolean;
}) {
  const reached = currentIndex(status);
  const lastAt = (s: Status) => [...(history ?? [])].reverse().find((h) => h.to === s)?.at;
  const reopened = status === 'Reopened';

  return (
    <div>
      <ol aria-label={`Progress: ${status}`} className="flex items-start">
        {STEPS.map((step, i) => {
          const done = i < reached || (i === reached && step === 'Resolved');
          const current = i === reached && step !== 'Resolved';
          const at = history && (done || current) ? lastAt(step) : undefined;
          return (
            <li
              key={step}
              className="relative flex flex-1 flex-col items-center text-center"
              aria-current={current ? 'step' : undefined}
            >
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 transition-colors duration-500 ${i <= reached ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
              )}
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300 ${
                  done
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : current
                      ? 'border-brand-600 bg-white text-brand-700 animate-pulse-ring'
                      : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                {done ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
                <span className="sr-only">
                  {done ? ' (done)' : current ? ' (current)' : ' (not yet)'}
                </span>
              </span>
              {!compact && (
                <>
                  <span
                    className={`mt-2 px-1 text-xs font-medium ${done || current ? 'text-navy-900' : 'text-slate-500'}`}
                  >
                    {step}
                  </span>
                  {at && <span className="text-[11px] text-slate-500">{formatDate(at)}</span>}
                </>
              )}
            </li>
          );
        })}
      </ol>
      {compact && (
        <p className="mt-1.5 text-xs text-slate-600">
          Step {Math.min(reached + 1, STEPS.length)} of {STEPS.length}:{' '}
          <span className="font-medium text-navy-800">{status}</span>
        </p>
      )}
      {reopened && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800 ring-1 ring-rose-200">
          <RotateCcw aria-hidden className="h-3 w-3" />
          Reopened after being resolved — back with the department
        </p>
      )}
    </div>
  );
}
