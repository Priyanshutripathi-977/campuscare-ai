/**
 * Status / priority badges. Each always shows a text label (and priority an icon),
 * so meaning never depends on colour alone.
 */
import type { Priority, Status } from '@campuscare/shared';

const pill =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap';

const STATUS_STYLES: Record<Status, string> = {
  Submitted: 'bg-slate-50 text-slate-700 ring-slate-300',
  'Under Review': 'bg-violet-50 text-violet-800 ring-violet-200',
  Assigned: 'bg-blue-50 text-blue-800 ring-blue-200',
  'In Progress': 'bg-amber-50 text-amber-900 ring-amber-200',
  Resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Reopened: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`${pill} ${STATUS_STYLES[status]}`}>{status}</span>;
}

const PRIORITY_STYLES: Record<Priority, { cls: string; icon: string }> = {
  Low: { cls: 'bg-slate-50 text-slate-700 ring-slate-300', icon: '↓' },
  Medium: { cls: 'bg-sky-50 text-sky-800 ring-sky-200', icon: '→' },
  High: { cls: 'bg-orange-50 text-orange-800 ring-orange-200', icon: '↑' },
  Critical: { cls: 'bg-red-600 text-white ring-red-600', icon: '!' },
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) {
    return (
      <span className={`${pill} bg-white text-slate-500 ring-slate-200`}>Priority pending</span>
    );
  }
  const s = PRIORITY_STYLES[priority];
  return (
    <span className={`${pill} ${s.cls}`}>
      <span aria-hidden className="font-bold">
        {s.icon}
      </span>
      {priority}
    </span>
  );
}

export function TagBadge({
  children,
  tone = 'slate',
}: {
  children: string;
  tone?: 'slate' | 'red' | 'violet' | 'amber';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  };
  return <span className={`${pill} ${tones[tone]}`}>{children}</span>;
}

/** Shown on seeded sample tickets so demo data is never mistaken for real data. */
export const DemoBadge = () => <TagBadge tone="amber">Demo data</TagBadge>;
