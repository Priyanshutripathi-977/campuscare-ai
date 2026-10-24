import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { listTickets } from '../../api/tickets';
import { PageHeader } from '../../components/AppLayout';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { Pagination } from '../../components/ui/Pagination';
import { TicketFilters, useTicketQueryFromUrl } from '../../components/tickets/TicketFilters';
import { TicketList } from '../../components/tickets/TicketList';

export function MyTicketsPage() {
  const query = useTicketQueryFromUrl(10);
  const [params, setParams] = useSearchParams();
  const tickets = useQuery({
    queryKey: ['tickets', query],
    queryFn: () => listTickets(query),
    placeholderData: keepPreviousData,
  });
  const filtered = [...params.keys()].some((k) => k !== 'page' && k !== 'sort');

  return (
    <div>
      <PageHeader
        title="My complaints"
        description="Track the status of everything you have reported."
        actions={<ButtonLink to="/student/new">Report a problem</ButtonLink>}
      />
      <TicketFilters />
      <div className="mt-4">
        {tickets.isPending ? (
          <PageLoader label="Loading your complaints…" />
        ) : tickets.isError ? (
          <ErrorState
            title="Could not load your complaints"
            error={tickets.error}
            onRetry={() => tickets.refetch()}
          />
        ) : tickets.data.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No complaints match these filters"
              description="Try clearing the filters or searching for something else."
            />
          ) : (
            <EmptyState
              title="You haven't reported anything yet"
              description="Spotted something broken on campus? Report it and track it here."
              action={<ButtonLink to="/student/new">Report a problem</ButtonLink>}
            />
          )
        ) : (
          <div aria-busy={tickets.isFetching || undefined}>
            <TicketList tickets={tickets.data.items} />
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
