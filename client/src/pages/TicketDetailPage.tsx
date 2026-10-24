/**
 * One ticket, seen by any role. What's shown depends on who is looking:
 *  - student: details, history, conversation, reopen (when resolved)
 *  - staff:   + status buttons for their department's tickets
 *  - admin:   + classification and assignment tools, routing explanation
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getTicket, ticketImageUrl } from '../api/tickets';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatLocation, relativeTime, REVIEW_REASON_LABELS } from '../lib/format';
import { Card } from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/States';
import { DemoBadge, PriorityBadge, StatusBadge, TagBadge } from '../components/tickets/Badges';
import { StatusTimeline } from '../components/tickets/StatusTimeline';
import { UpdatesThread } from '../components/tickets/UpdatesThread';
import { StatusActions } from '../components/tickets/StatusActions';
import { ReopenAction } from '../components/tickets/ReopenAction';
import { AdminRoutingPanel } from '../components/tickets/AdminRoutingPanel';

export function TicketDetailPage() {
  const { ticketId = '' } = useParams();
  const { user } = useAuth();
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    retry: false,
  });
  const backTo = user?.role === 'student' ? '/student' : '/admin/tickets';

  if (ticket.isPending) return <PageLoader label="Loading ticket…" />;
  if (ticket.isError) {
    const notFound =
      ticket.error instanceof ApiError &&
      (ticket.error.status === 404 || ticket.error.status === 400);
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorState
          title={notFound ? 'Ticket not found' : 'Could not load this ticket'}
          error={
            notFound
              ? new Error(`No ticket “${ticketId}” exists, or you don't have access to it.`)
              : ticket.error
          }
          onRetry={notFound ? undefined : () => ticket.refetch()}
        />
        <p className="text-center">
          <Link to={backTo} className="text-sm font-medium text-brand-700 hover:underline">
            ← Back to tickets
          </Link>
        </p>
      </div>
    );
  }

  const t = ticket.data;
  const role = user!.role;
  const isStaffOrAdmin = role !== 'student';

  return (
    <div>
      <Link to={backTo} className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to tickets
      </Link>

      <div className="mt-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-slate-500">{t.ticketId}</span>
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          {t.overdue && <TagBadge tone="red">Overdue</TagBadge>}
          {isStaffOrAdmin && t.needsReview && <TagBadge tone="violet">Needs review</TagBadge>}
          {t.isDemo && <DemoBadge />}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{t.title}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {t.description}
            </p>
            {t.hasImage && <TicketImage ticketId={t.ticketId} />}
            <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <Info
                label="Location"
                value={formatLocation(t.location)}
                extra={t.location.details}
              />
              <Info
                label="Category"
                value={t.category ?? 'Not classified yet'}
                extra={
                  t.studentCategory && t.studentCategory !== t.category
                    ? `Student suggested: ${t.studentCategory}`
                    : undefined
                }
              />
              <Info label="Department" value={t.department?.name ?? 'Not assigned yet'} />
              <Info
                label="Assigned to"
                value={t.assignedTo?.name ?? (t.department ? 'Anyone in the department' : '—')}
              />
              <Info label="Submitted" value={formatDateTime(t.createdAt)} />
              <Info
                label={t.status === 'Resolved' ? 'Resolved' : 'Target resolution'}
                value={
                  t.status === 'Resolved' && t.resolvedAt
                    ? formatDateTime(t.resolvedAt)
                    : t.dueAt
                      ? `${formatDateTime(t.dueAt)} (${relativeTime(t.dueAt)})`
                      : 'Set after classification'
                }
              />
              {t.student && (
                <Info label="Reported by" value={t.student.name} extra={t.student.email} />
              )}
            </dl>
          </Card>

          <Card title={`Updates (${t.updates.length})`}>
            <UpdatesThread ticket={t} />
          </Card>
        </div>

        <div className="space-y-6">
          {role === 'student' && t.status === 'Resolved' && (
            <Card title="Not fixed?">
              <ReopenAction ticket={t} />
            </Card>
          )}
          {isStaffOrAdmin && (
            <Card title="Status">
              <StatusActions ticket={t} role={role} />
            </Card>
          )}
          {role === 'admin' && (
            <Card title="Classification & routing">
              <AdminRoutingPanel ticket={t} />
            </Card>
          )}
          {isStaffOrAdmin && t.routing && (
            <Card title="Routing decision">
              <dl className="space-y-2 text-sm">
                <Info
                  label="Method"
                  value={
                    {
                      auto: 'Automatic',
                      manual: 'Manual (administrator)',
                      admin_review: 'Waiting for administrator',
                    }[t.routing.method]
                  }
                />
                <Info label="Reason" value={t.routing.reason} />
                <Info label="Decided" value={formatDateTime(t.routing.decidedAt)} />
                {t.reviewReasons.length > 0 && (
                  <Info
                    label="Review needed because"
                    value={t.reviewReasons.map((r) => REVIEW_REASON_LABELS[r] ?? r).join('; ')}
                  />
                )}
              </dl>
            </Card>
          )}
          <Card title="History">
            <StatusTimeline history={t.statusHistory} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, extra }: { label: string; value: string; extra?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
      {extra && <dd className="text-xs text-slate-500">{extra}</dd>}
    </div>
  );
}

function TicketImage({ ticketId }: { ticketId: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <p className="mt-4 text-sm text-slate-500">The attached photo could not be loaded.</p>;
  return (
    <a
      href={ticketImageUrl(ticketId)}
      target="_blank"
      rel="noreferrer"
      className="mt-4 inline-block"
    >
      <img
        src={ticketImageUrl(ticketId)}
        alt="Photo attached to this complaint"
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-h-80 rounded-lg border border-slate-200 object-contain"
      />
    </a>
  );
}
