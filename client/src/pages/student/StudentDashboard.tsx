/**
 * Student home: a clear "Report a problem" action, my ticket counts and my latest tickets.
 * All numbers come from the real ticket list endpoint (it returns totals per filter).
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, FilePlus2, Hourglass, ListChecks, Wrench } from 'lucide-react';
import { listTickets } from '../../api/tickets';
import { useAuth } from '../../context/AuthContext';
import { ButtonLink } from '../../components/ui/Button';
import { KpiCard } from '../../components/ui/KpiCard';
import { Skeleton, SkeletonCards } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Card } from '../../components/ui/Card';
import { TicketList } from '../../components/tickets/TicketList';

const COUNTS = [
  { key: 'all', query: {} },
  { key: 'Resolved', query: { status: 'Resolved' } },
  { key: 'Under Review', query: { status: 'Under Review' } },
  { key: 'Submitted', query: { status: 'Submitted' } },
] as const;

export function StudentDashboard() {
  const { user } = useAuth();
  const counts = useQueries({
    queries: COUNTS.map((c) => ({
      queryKey: ['tickets', 'count', c.key],
      queryFn: () => listTickets({ ...c.query, limit: 1 }),
    })),
  });
  const recent = useQuery({
    queryKey: ['tickets', 'recent'],
    queryFn: () => listTickets({ limit: 4, sort: 'newest' }),
  });

  const loadingCounts = counts.some((c) => c.isPending);
  const countsError = counts.find((c) => c.isError)?.error;
  const [all, resolved, review, submitted] = counts.map((c) => c.data?.total ?? 0);
  const waiting = (review ?? 0) + (submitted ?? 0);
  const withDept = (all ?? 0) - (resolved ?? 0) - waiting; // Assigned + In Progress + Reopened
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white shadow-card sm:p-8">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5"
        />
        <div className="relative">
          <p className="text-sm font-medium text-brand-100">Hi {firstName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight !text-white sm:text-3xl">
            Spotted something broken on campus?
          </h1>
          <p className="mt-2 max-w-xl text-sm text-brand-100">
            Report it in a minute. It gets a ticket ID, goes to the right department, and you can
            follow every step here.
          </p>
          <ButtonLink
            to="/student/new"
            size="lg"
            icon={FilePlus2}
            className="mt-5 !bg-white !text-brand-700 hover:!bg-brand-50"
          >
            Report a problem
          </ButtonLink>
        </div>
      </section>

      {/* Counts */}
      {countsError ? (
        <ErrorState
          title="Could not load your ticket counts"
          error={countsError}
          onRetry={() => counts.forEach((c) => c.refetch())}
        />
      ) : loadingCounts ? (
        <div role="status" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <span className="sr-only">Loading your ticket counts…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="All my complaints"
            value={all ?? 0}
            icon={ListChecks}
            to="/student/tickets"
          />
          <KpiCard
            label="Waiting for review"
            value={waiting}
            icon={Hourglass}
            accent="violet"
            to="/student/tickets?status=Under%20Review"
            hint="An admin will confirm and route them"
          />
          <KpiCard
            label="With a department"
            value={withDept}
            icon={Wrench}
            accent="amber"
            hint="Assigned, in progress or reopened"
          />
          <KpiCard
            label="Resolved"
            value={resolved ?? 0}
            icon={CheckCircle2}
            accent="emerald"
            to="/student/tickets?status=Resolved"
          />
        </div>
      )}

      {/* Recent */}
      <Card
        title="My latest complaints"
        actions={
          <ButtonLink to="/student/tickets" variant="ghost" size="sm">
            View all
            <ArrowRight aria-hidden className="h-4 w-4" />
          </ButtonLink>
        }
      >
        {recent.isPending ? (
          <SkeletonCards count={2} label="Loading your latest complaints…" />
        ) : recent.isError ? (
          <ErrorState
            title="Could not load your complaints"
            error={recent.error}
            onRetry={() => recent.refetch()}
          />
        ) : recent.data.items.length === 0 ? (
          <EmptyState
            title="You haven't reported anything yet"
            description="Spotted something broken on campus? Report it and track it here."
            action={
              <ButtonLink to="/student/new" icon={FilePlus2}>
                Report a problem
              </ButtonLink>
            }
          />
        ) : (
          <TicketList tickets={recent.data.items} />
        )}
      </Card>

      {/* How it works (explains the real process) */}
      <section aria-labelledby="how-it-works" className="grid gap-4 sm:grid-cols-3">
        <h2 id="how-it-works" className="sr-only">
          How it works
        </h2>
        {[
          { n: 1, t: 'You report it', d: 'Describe the problem and where it is. A photo helps.' },
          {
            n: 2,
            t: 'It is analysed and routed',
            d: 'The system suggests a category and priority. Confident cases go straight to a department; others are checked by an admin.',
          },
          {
            n: 3,
            t: 'You follow it',
            d: 'Every status change appears on your ticket and in your notifications.',
          },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
            >
              {s.n}
            </span>
            <p className="mt-3 font-semibold text-navy-900">{s.t}</p>
            <p className="mt-1 text-sm text-slate-600">{s.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
