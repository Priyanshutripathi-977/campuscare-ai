import type { NotificationDTO } from '@campuscare/shared';
import { relativeTime } from '../../lib/format';

/** Email status shown honestly: sent, failed (with reason), pending, or in-app only. */
export function EmailStatus({ email }: { email: NotificationDTO['email'] }) {
  if (email.status === 'sent') return <span className="text-emerald-700">✓ Email sent</span>;
  if (email.status === 'failed')
    return (
      <span className="text-red-700" title={email.error ?? undefined}>
        ✕ Email failed
      </span>
    );
  if (email.status === 'pending') return <span className="text-slate-500">Email sending…</span>;
  return <span className="text-slate-400">In-app only</span>;
}

export function NotificationItem({
  n,
  onOpen,
}: {
  n: NotificationDTO;
  onOpen: (n: NotificationDTO) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={`block w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none ${n.read ? '' : 'bg-brand-50/60'}`}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand-600'}`}
        />
        <div className="min-w-0">
          <p className={`text-sm ${n.read ? 'text-slate-700' : 'font-medium text-slate-900'}`}>
            {!n.read && <span className="sr-only">Unread: </span>}
            {n.message}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
            {n.ticket && <span className="font-mono">{n.ticket.ticketId}</span>}
            <span>{relativeTime(n.createdAt)}</span>
            <EmailStatus email={n.email} />
          </p>
        </div>
      </div>
    </button>
  );
}
