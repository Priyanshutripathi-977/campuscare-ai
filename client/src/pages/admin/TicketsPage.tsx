import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { listTickets } from '../../api/tickets';
import { getDepartments } from '../../api/admin';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/AppLayout';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { Pagination } from '../../components/ui/Pagination';
import { TicketFilters, useTicketQueryFromUrl } from '../../components/tickets/TicketFilters';
import { TicketTable } from '../../components/tickets/TicketTable';

export function TicketsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const query = useTicketQueryFromUrl(15);
  const [params, setParams] = useSearchParams();
  const tickets = useQuery({
    queryKey: ['tickets', query],
    queryFn: () => listTickets(query),
    placeholderData: keepPreviousData,
  });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  });

  const reviewMode = params.get('needsReview') === 'true';

  return (
    <div>
      <PageHeader
        title={
          reviewMode
            ? 'Review queue'
            : isAdmin
              ? 'All tickets'
              : `${user?.department?.name ?? 'Department'} tickets`
        }
        description={
          reviewMode
            ? 'Tickets waiting for an administrator to set category, priority and department.'
            : 'Search, filter and open any ticket to act on it.'
        }
      />
      <TicketFilters showAdminFilters={isAdmin} departments={departments.data} />
      <div className="mt-4">
        {tickets.isPending ? (
          <PageLoader label="Loading tickets…" />
        ) : tickets.isError ? (
          <ErrorState
            title="Could not load tickets"
            error={tickets.error}
            onRetry={() => tickets.refetch()}
          />
        ) : tickets.data.items.length === 0 ? (
          <EmptyState
            title={reviewMode ? 'The review queue is empty' : 'No tickets found'}
            description="Try changing or clearing the filters."
          />
        ) : (
          <div
            aria-busy={tickets.isFetching || undefined}
            className={tickets.isPlaceholderData ? 'opacity-60' : ''}
          >
            <TicketTable tickets={tickets.data.items} />
            <Pagination
              page={tickets.data.page}
              pages={tickets.data.pages}
              total={tickets.data.total}
              onChange={(p) => {
                const next = new URLSearchParams(params);
                next.set('page', String(p));
                setParams(next);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
