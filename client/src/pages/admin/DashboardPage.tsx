/**
 * Admin / staff dashboard. Every number and chart comes from GET /api/admin/stats,
 * which counts real tickets in the database (admins: whole campus; staff: their department).
 */
import { useQuery } from '@tanstack/react-query';
import { CATEGORIES, PRIORITIES, STATUSES } from '@campuscare/shared';
import { getStats } from '../../api/admin';
import { listTickets } from '../../api/tickets';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/AppLayout';
import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, PageLoader } from '../../components/ui/States';
import { StatTile } from '../../components/charts/StatTile';
import { ChartCard } from '../../components/charts/ChartCard';
import { HorizontalBarChart } from '../../components/charts/HorizontalBarChart';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import { TicketList } from '../../components/tickets/TicketList';

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const stats = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const overdue = useQuery({
    queryKey: ['tickets', { overdue: 'true', sort: 'due', limit: 5 }],
    queryFn: () => listTickets({ overdue: 'true', sort: 'due', limit: 5 }),
  });
  const review = useQuery({
    queryKey: ['tickets', { needsReview: 'true', sort: 'oldest', limit: 5 }],
    queryFn: () => listTickets({ needsReview: 'true', sort: 'oldest', limit: 5 }),
    enabled: isAdmin,
  });

  const title = isAdmin
    ? 'Campus dashboard'
    : `${user?.department?.name ?? 'Department'} dashboard`;

  if (stats.isPending) return <PageLoader label="Loading dashboard…" />;
  if (stats.isError)
    return (
      <ErrorState
        title="Could not load the dashboard"
        error={stats.error}
        onRetry={() => stats.refetch()}
      />
    );

  const s = stats.data;
  const rows = (rec: Record<string, number>, order: readonly string[], extra?: string) =>
    [...order, ...(extra && rec[extra] ? [extra] : [])].map((k) => ({
      label: k,
      value: rec[k] ?? 0,
    }));

  const statusRows = rows(s.byStatus, STATUSES);
  const categoryRows = rows(s.byCategory, CATEGORIES, 'Unclassified');
  const priorityRows = rows(s.byPriority, PRIORITIES, 'Unassessed');
  const deptRows = s.byDepartment.map((d) => ({ label: d.name, value: d.count }));
  const trendRows = s.createdPerDay.map((d) => ({ label: d.date, value: d.count }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={
          isAdmin
            ? 'Live overview of every complaint on campus.'
            : 'Live overview of complaints routed to your department.'
        }
        actions={
          <ButtonLink to="/admin/tickets" variant="secondary">
            Open ticket list
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total tickets" value={s.total} to="/admin/tickets" />
        <StatTile label="Open" value={s.open} hint="Not yet resolved" />
        {isAdmin && (
          <StatTile
            label="Needs review"
            value={s.needsReview}
            to="/admin/tickets?needsReview=true"
            tone="attention"
            hint="Awaiting classification / routing"
          />
        )}
        <StatTile
          label="Overdue"
          value={s.overdue}
          to="/admin/tickets?overdue=true"
          tone="attention"
          hint="Past their target time"
        />
        <StatTile
          label="Avg. resolution"
          value={s.avgResolutionHours === null ? '—' : `${s.avgResolutionHours} h`}
          hint={`${s.resolved} resolved`}
        />
      </div>

      <ChartCard title="New complaints, last 14 days" rows={trendRows} valueLabel="New complaints">
        <TrendLineChart data={s.createdPerDay} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="By status" rows={statusRows}>
          <HorizontalBarChart data={statusRows} />
        </ChartCard>
        <ChartCard title="By category" rows={categoryRows}>
          <HorizontalBarChart data={categoryRows} />
        </ChartCard>
        <ChartCard
          title="By priority"
          description="Unassessed = not yet classified"
          rows={priorityRows}
        >
          <HorizontalBarChart data={priorityRows} />
        </ChartCard>
        {isAdmin && (
          <ChartCard title="By department" rows={deptRows}>
            <HorizontalBarChart data={deptRows} />
          </ChartCard>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MiniList
          title="Overdue tickets"
          query={overdue}
          empty="Nothing is overdue. 🎉"
          link="/admin/tickets?overdue=true"
        />
        {isAdmin && (
          <MiniList
            title="Review queue (oldest first)"
            query={review}
            empty="No tickets waiting for review."
            link="/admin/tickets?needsReview=true&sort=oldest"
          />
        )}
      </div>
    </div>
  );
}

function MiniList({
  title,
  query,
  empty,
  link,
}: {
  title: string;
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listTickets>>>>;
  empty: string;
  link: string;
}) {
  return (
    <Card
      title={title}
      actions={
        <ButtonLink to={link} variant="ghost" size="sm">
          View all
        </ButtonLink>
      }
    >
      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <TicketList tickets={query.data.items} />
      )}
    </Card>
  );
}
