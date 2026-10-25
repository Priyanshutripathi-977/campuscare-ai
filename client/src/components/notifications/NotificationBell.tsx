/** Header bell: unread count + a dropdown with the latest notifications. */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { NotificationDTO } from '@campuscare/shared';
import { Spinner } from '../ui/Spinner';
import { NotificationItem } from './NotificationItem';
import { useNotificationActions, useNotificationSummary } from './useNotifications';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const summary = useNotificationSummary();
  const { markRead, markAll } = useNotificationActions();
  const unread = summary.data?.unreadCount ?? 0;

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) =>
      !wrapper.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const openNotification = (n: NotificationDTO) => {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.ticket) navigate(`/tickets/${n.ticket.ticketId}`);
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          // Phones: full-width sheet below the header (16px margins). Larger screens: dropdown under the bell.
          className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {summary.isPending ? (
              <div className="p-4">
                <Spinner />
              </div>
            ) : summary.isError ? (
              <p role="alert" className="p-4 text-sm text-red-700">
                Could not load notifications. {summary.error.message}
              </p>
            ) : summary.data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">You're all caught up.</p>
            ) : (
              summary.data.items.map((n) => (
                <NotificationItem key={n.id} n={n} onOpen={openNotification} />
              ))
            )}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-slate-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
