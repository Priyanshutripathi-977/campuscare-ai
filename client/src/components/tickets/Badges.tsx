/**
 * Status / priority badges. Each always shows a text label plus an icon,
 * so meaning never depends on colour alone.
 */
import {
  AlertOctagon,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Eye,
  Inbox,
  RotateCcw,
  UserCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Priority, Status } from '@campuscare/shared';

const pill =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap';

export const STATUS_META: Record<Status, { cls: string; icon: LucideIcon }> = {
  Submitted: { cls: 'bg-slate-50 text-slate-700 ring-slate-300', icon: Inbox },
  'Under Review': { cls: 'bg-violet-50 text-violet-800 ring-violet-200', icon: Eye },
  Assigned: { cls: 'bg-blue-50 text-blue-800 ring-blue-200', icon: UserCheck },
  'In Progress': { cls: 'bg-amber-50 text-amber-900 ring-amber-200', icon: Wrench },
  Resolved: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  Reopened: { cls: 'bg-rose-50 text-rose-800 ring-rose-200', icon: RotateCcw },
};

export function StatusBadge({ status }: { status: Status }) {
  const { cls, icon: Icon } = STATUS_META[status];
  return (
    <span className={`${pill} ${cls}`}>
      <Icon aria-hidden className="h-3 w-3" />
      {status}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, { cls: string; icon: LucideIcon }> = {
  Low: { cls: 'bg-slate-50 text-slate-700 ring-slate-300', icon: ArrowDown },
  Medium: { cls: 'bg-sky-50 text-sky-800 ring-sky-200', icon: ArrowRight },
  High: { cls: 'bg-orange-50 text-orange-800 ring-orange-200', icon: ArrowUp },
  Critical: { cls: 'bg-red-600 text-white ring-red-600', icon: AlertOctagon },
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) {
    return (
      <span className={`${pill} bg-white text-slate-600 ring-slate-200`}>Priority pending</span>
    );
  }
  const { cls, icon: Icon } = PRIORITY_STYLES[priority];
  return (
    <span className={`${pill} ${cls}`}>
      <Icon aria-hidden className="h-3 w-3" />
      {priority}
    </span>
  );
}

export function TagBadge({
  children,
  tone = 'slate',
}: {
  children: string;
  tone?: 'slate' | 'red' | 'violet' | 'amber' | 'brand';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  };
  return <span className={`${pill} ${tones[tone]}`}>{children}</span>;
}

/** Shown on seeded sample tickets so demo data is never mistaken for real data. */
export const DemoBadge = () => <TagBadge tone="amber">Demo data</TagBadge>;
