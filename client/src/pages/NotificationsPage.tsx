import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import type { NotificationDTO } from '@campuscare/shared';
import { listNotifications } from '../api/notifications';
import { PageHeader } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { NotificationItem } from '../components/notifications/NotificationItem';
import { useNotificationActions } from '../components/notifications/useNotifications';

export function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const unreadOnly = params.get('filter') === 'unread';
  const page = Number(params.get('page') ?? 1) || 1;
  const navigate = useNavigate();
  const { markRead, markAll } = useNotificationActions();
  const list = useQuery({
    queryKey: ['notifications', 'page', unreadOnly, page],
    queryFn: () => listNotifications({ unread: unreadOnly, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const open = (n: NotificationDTO) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.ticket) navigate(`/tickets/${n.ticket.ticketId}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates about tickets you reported or work on."
        actions={
          <Button
            variant="secondary"
            disabled={!list.data?.unreadCount}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        }
      />
      <div role="tablist" aria-label="Filter" className="mb-4 flex gap-1 border-b border-slate-200">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: `Unread${list.data ? ` (${list.data.unreadCount})` : ''}` },
        ].map((t) => {
          const selected = (t.id === 'unread') === unreadOnly;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setParams(t.id === 'unread' ? { filter: 'unread' } : {})}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${selected ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {list.isPending ? (
        <PageLoader label="Loading notifications…" />
      ) : list.isError ? (
        <ErrorState
          title="Could not load notifications"
          error={list.error}
          onRetry={() => list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="You'll be notified here when one of your tickets changes."
        />
      ) : (
        <>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            {list.data.items.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={open} />
            ))}
          </div>
          <Pagination
            page={list.data.page}
            pages={list.data.pages}
            total={list.data.total}
            onChange={(p) =>
              setParams({ ...(unreadOnly ? { filter: 'unread' } : {}), page: String(p) })
            }
          />
        </>
      )}
    </div>
  );
}
