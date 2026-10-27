/**
 * Admin / staff dashboard. Every number and chart comes from GET /api/admin/stats or the
 * ticket list endpoint — real database counts (admins: whole campus; staff: their department).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  Copy,
  Hourglass,
  Inbox,
  ScanSearch,
  Search,
  Settings,
  Siren,
  Timer,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORIES, PRIORITIES, STATUSES, TICKET_SORTS, type StatsDTO } from '@campuscare/shared';
import { getStats } from '../../api/admin';
import { listTickets } from '../../api/tickets';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/AppLayout';
import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { KpiCard } from '../../components/ui/KpiCard';
import { Skeleton, SkeletonGroup, SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { ChartCard } from '../../components/charts/ChartCard';
import { HorizontalBarChart } from '../../components/charts/HorizontalBarChart';
import { TrendLineChart } from '../../components/charts/TrendLineChart';
import { DepartmentPerformance } from '../../components/charts/DepartmentPerformance';
import { TicketTable } from '../../components/tickets/TicketTable';

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const stats = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const title = isAdmin
    ? 'Campus dashboard'
    : `${user?.department?.name ?? 'Department'} dashboard`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isAdmin ? 'Overview' : 'Your department'}
        title={title}
        description={
          isAdmin
            ? 'Live overview of every complaint on campus.'
            : 'Live overview of complaints routed to your department.'
        }
        actions={
          <>
            {isAdmin && (
              <ButtonLink to="/admin/tickets?needsReview=true" variant="soft" icon={ScanSearch}>
                Review queue
              </ButtonLink>
            )}
            <ButtonLink to="/admin/tickets" variant="secondary" icon={Inbox}>
              All tickets
            </ButtonLink>
          </>
        }
      />

      {stats.isPending ? (
        <DashboardSkeleton />
      ) : stats.isError ? (
        <ErrorState
          title="Could not load the dashboard"
          error={stats.error}
          onRetry={() => stats.refetch()}
        />
      ) : (
        <DashboardBody stats={stats.data} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function DashboardBody({ stats: s, isAdmin }: { stats: StatsDTO; isAdmin: boolean }) {
  const pending = (s.byStatus.Submitted ?? 0) + (s.byStatus['Under Review'] ?? 0);
  const urgentCritical = s.openByPriority.Critical ?? 0;
  const urgentHigh = s.openByPriority.High ?? 0;

  const rows = (rec: Record<string, number>, order: readonly string[], extra?: string) =>
    [...order, ...(extra && rec[extra] ? [extra] : [])].map((k) => ({
      label: k,
      value: rec[k] ?? 0,
    }));
  const statusRows = rows(s.byStatus, STATUSES);
  const categoryRows = rows(s.byCategory, CATEGORIES, 'Unclassified');
  const priorityRows = rows(s.byPriority, PRIORITIES, 'Unassessed');
  const trendRows = s.createdPerDay.map((d) => ({ label: d.date, value: d.count }));

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total complaints"
          value={s.total}
          icon={Inbox}
          to="/admin/tickets"
          hint={`${s.open} open`}
        />
        <KpiCard
          label="Pending review"
          value={pending}
          icon={Hourglass}
          accent="violet"
          to="/admin/tickets?status=Under%20Review"
          hint="Waiting for an admin to route"
        />
        <KpiCard
          label="In progress"
          value={s.byStatus['In Progress'] ?? 0}
          icon={Wrench}
          accent="amber"
          to="/admin/tickets?status=In%20Progress"
          hint={`${s.byStatus.Assigned ?? 0} assigned, not started`}
        />
        <KpiCard
          label="Resolved"
          value={s.resolved}
          icon={CheckCircle2}
          accent="emerald"
          to="/admin/tickets?status=Resolved"
        />
        <KpiCard
          label="Urgent (open)"
          value={urgentCritical + urgentHigh}
          icon={Siren}
          accent="red"
          emphasize
          to="/admin/tickets?sort=priority"
          hint={`${urgentCritical} critical · ${urgentHigh} high`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Trend + categories */}
        <div className="space-y-6 xl:col-span-2">
          <ChartCard
            title="New complaints, last 14 days"
            rows={trendRows}
            valueLabel="New complaints"
          >
            <TrendLineChart data={s.createdPerDay} />
          </ChartCard>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="By category" rows={categoryRows}>
              <HorizontalBarChart data={categoryRows} />
            </ChartCard>
            <ChartCard title="By status" rows={statusRows}>
              <HorizontalBarChart data={statusRows} />
            </ChartCard>
          </div>
        </div>

        {/* Quick actions + secondary numbers */}
        <div className="space-y-6">
          <Card title="Quick actions">
            <ul className="space-y-2">
              {isAdmin && (
                <QuickAction
                  to="/admin/tickets?needsReview=true"
                  icon={ScanSearch}
                  label="Review uncertain complaints"
                  count={s.needsReview}
                />
              )}
              {isAdmin && s.pendingDuplicates !== null && (
                <QuickAction
                  to="/admin/duplicates"
                  icon={Copy}
                  label="Check possible duplicates"
                  count={s.pendingDuplicates}
                />
              )}
              <QuickAction
                to="/admin/tickets?overdue=true&sort=due"
                icon={AlarmClock}
                label="Handle overdue tickets"
                count={s.overdue}
                danger
              />
              <QuickAction
                to="/admin/tickets?sort=priority"
                icon={Siren}
                label="Most urgent first"
              />
              {isAdmin && (
                <QuickAction
                  to="/admin/settings"
                  icon={Settings}
                  label="Routing rules & deadlines"
                />
              )}
            </ul>
          </Card>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
            <KpiCard
              label="Overdue"
              value={s.overdue}
              icon={AlarmClock}
              accent="red"
              emphasize
              to="/admin/tickets?overdue=true"
              hint="Past their target time"
            />
            <KpiCard
              label="Avg. time to resolve"
              value={s.avgResolutionHours === null ? '—' : `${s.avgResolutionHours} h`}
              icon={Timer}
              accent="slate"
              hint={`Across ${s.resolved} resolved tickets`}
            />
          </div>
          <ChartCard
            title="By priority"
            description="All tickets; Unassessed = not yet classified"
            rows={priorityRows}
          >
            <HorizontalBarChart data={priorityRows} />
          </ChartCard>
        </div>
      </div>

      {isAdmin && (
        <Card
          title="Department performance"
          description="Workload and resolution speed per department (unassigned tickets excluded)."
        >
          <DepartmentPerformance rows={s.departmentPerformance} />
        </Card>
      )}

      <RecentComplaints />
    </>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  count,
  danger = false,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  danger?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className="group flex items-center gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5 text-sm transition-all hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <Icon aria-hidden className="h-4 w-4 text-brand-600" />
        <span className="flex-1 font-medium text-navy-800">{label}</span>
        {typeof count === 'number' && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
              count > 0 && danger
                ? 'bg-red-100 text-red-800'
                : count > 0
                  ? 'bg-brand-100 text-brand-800'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {count}
          </span>
        )}
        <ArrowRight
          aria-hidden
          className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
        />
      </Link>
    </li>
  );
}

const SORT_LABELS: Record<(typeof TICKET_SORTS)[number], string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  priority: 'Highest priority',
  due: 'Due soonest',
};

/** A compact, interactive table of the latest complaints (search / status / sort). */
function RecentComplaints() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<(typeof TICKET_SORTS)[number]>('newest');
  const query = { q: search || undefined, status: status || undefined, sort, limit: 8 };
  const list = useQuery({
    queryKey: ['tickets', 'recent-admin', query],
    queryFn: () => listTickets(query),
    placeholderData: keepPreviousData,
  });
  const control =
    'h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-800 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/25';
  const fullListLink = `/admin/tickets?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(status ? { status } : {}), ...(sort !== 'newest' ? { sort } : {}) }).toString()}`;

  return (
    <Card
      title="Recent complaints"
      actions={
        <ButtonLink to={fullListLink} variant="ghost" size="sm">
          Open full list
          <ArrowRight aria-hidden className="h-4 w-4" />
        </ButtonLink>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <form
          role="search"
          className="relative min-w-48 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <label htmlFor="recent-search" className="sr-only">
            Search recent complaints
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          />
          <input
            id="recent-search"
            type="search"
            value={q}
            maxLength={100}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value) setSearch('');
            }}
            placeholder="Search and press Enter…"
            className={`${control} w-full pl-9`}
          />
        </form>
        <label>
          <span className="sr-only">Status</span>
          <select className={control} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort</span>
          <select
            className={control}
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            {TICKET_SORTS.map((so) => (
              <option key={so} value={so}>
                {SORT_LABELS[so]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <SkeletonTable rows={5} label="Loading recent complaints…" />
      ) : list.isError ? (
        <ErrorState
          title="Could not load complaints"
          error={list.error}
          onRetry={() => list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title="No complaints match"
          description={
            search || status ? 'Try another search or status.' : 'New complaints will appear here.'
          }
        />
      ) : (
        <div
          aria-busy={list.isFetching || undefined}
          className={
            list.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'
          }
        >
          <TicketTable tickets={list.data.items} />
        </div>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <SkeletonGroup label="Loading dashboard…">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </SkeletonGroup>
  );
}
