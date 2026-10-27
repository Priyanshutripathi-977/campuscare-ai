import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';

type Tone = 'error' | 'success' | 'info' | 'warning';

const tones: Record<Tone, { cls: string; icon: LucideIcon }> = {
  error: { cls: 'border-red-200 bg-red-50 text-red-800', icon: XCircle },
  success: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
  info: { cls: 'border-blue-200 bg-blue-50 text-blue-900', icon: Info },
  warning: { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
};

/** Errors are announced immediately (role=alert); other tones politely (role=status). */
export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
}) {
  const { cls, icon: Icon } = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border p-3.5 text-sm animate-fade-in ${cls}`}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}
