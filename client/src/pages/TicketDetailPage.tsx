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
import { ErrorState } from '../components/ui/States';
import { DemoBadge, PriorityBadge, StatusBadge, TagBadge } from '../components/tickets/Badges';
import { StatusTimeline } from '../components/tickets/StatusTimeline';
import { UpdatesThread } from '../components/tickets/UpdatesThread';
import { StatusActions } from '../components/tickets/StatusActions';
import { ReopenAction } from '../components/tickets/ReopenAction';
import { AdminRoutingPanel } from '../components/tickets/AdminRoutingPanel';
import { AiAnalysisCard } from '../components/tickets/AiAnalysisCard';
import { DuplicatesPanel } from '../components/tickets/DuplicatesPanel';
import { Alert } from '../components/ui/Alert';
import { Skeleton, SkeletonGroup } from '../components/ui/Skeleton';
import { TicketProgress } from '../components/tickets/TicketProgress';
import {
  ArrowLeft,
  Bot,
  Cpu,
  FileText,
  GitBranch,
  History,
  MessageSquare,
  Sparkles,
  Workflow,
} from 'lucide-react';
import type { TicketDetailDTO } from '@campuscare/shared';

export function TicketDetailPage() {
  const { ticketId = '' } = useParams();
  const { user } = useAuth();
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    retry: false,
  });
  const backTo = user?.role === 'student' ? '/student/tickets' : '/admin/tickets';

  if (ticket.isPending) return <TicketSkeleton />;
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
            Back to tickets
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
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Back to tickets
      </Link>

      <div className="mt-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-slate-600">{t.ticketId}</span>
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          {t.overdue && <TagBadge tone="red">Overdue</TagBadge>}
          {isStaffOrAdmin && t.needsReview && <TagBadge tone="violet">Needs review</TagBadge>}
          {t.isDemo && <DemoBadge />}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy-900 sm:text-[28px]">
          {t.title}
        </h1>
      </div>

      <section
        aria-label="Ticket progress"
        className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 shadow-card sm:px-8"
      >
        <TicketProgress status={t.status} history={t.statusHistory} />
      </section>

      {role === 'student' && t.ai?.view === 'student' && t.ai.needsClarification && (
        <div className="mb-6">
          <Alert tone="warning" title="We need a few more details">
            <p>{t.ai.clarificationQuestion ?? 'Please describe the problem in more detail.'}</p>
            <p className="mt-1">
              Answer by adding an update below — your ticket will be re-checked automatically.
            </p>
          </Alert>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Details" icon={FileText}>
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

          <Card title={`Updates (${t.updates.length})`} icon={MessageSquare}>
            <UpdatesThread ticket={t} />
          </Card>
        </div>

        <div className="space-y-6">
          {role === 'student' && t.ai?.view === 'student' && (
            <StudentAiSummary ai={t.ai} ticket={t} />
          )}
          {role === 'student' && t.status === 'Resolved' && (
            <Card title="Not fixed?">
              <ReopenAction ticket={t} />
            </Card>
          )}
          {isStaffOrAdmin && (
            <Card title="Status" icon={Workflow}>
              <StatusActions ticket={t} role={role} />
            </Card>
          )}
          {role === 'admin' && (
            <Card title="Classification & routing" icon={GitBranch}>
              <AdminRoutingPanel ticket={t} />
            </Card>
          )}
          {(role === 'admin' || t.duplicates.duplicateOf) && (
            <Card title="Duplicates">
              <DuplicatesPanel ticket={t} isAdmin={role === 'admin'} />
            </Card>
          )}
          {isStaffOrAdmin && (
            <Card title="AI analysis" icon={Sparkles}>
              <AiAnalysisCard ticket={t} canRerun={role === 'admin'} />
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
          <Card title="History" icon={History}>
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
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-navy-900">{value}</dd>
      {extra && <dd className="text-xs text-slate-600">{extra}</dd>}
    </div>
  );
}

function TicketImage({ ticketId }: { ticketId: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <p className="mt-4 text-sm text-slate-600">The attached photo could not be loaded.</p>;
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
        className="max-h-80 rounded-xl border border-slate-200 object-contain transition-shadow hover:shadow-card-hover"
      />
    </a>
  );
}

/** The student's view of how their complaint was analysed (summary + suggestion, no internals). */
function StudentAiSummary({
  ai,
  ticket,
}: {
  ai: Extract<TicketDetailDTO['ai'], { view: 'student' }>;
  ticket: TicketDetailDTO;
}) {
  const routedAutomatically =
    ticket.department && ticket.statusHistory.some((h) => h.to === 'Assigned' && !h.by);
  return (
    <Card title="How your complaint was analysed" icon={Bot}>
      <div className="space-y-3 text-sm">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {ai.source === 'gemini' ? (
            <Sparkles aria-hidden className="h-3.5 w-3.5 text-brand-600" />
          ) : (
            <Cpu aria-hidden className="h-3.5 w-3.5" />
          )}
          {ai.source === 'gemini' ? 'Gemini AI' : 'Keyword classifier (not AI)'}
        </p>
        {ai.summary && <p className="text-slate-700">{ai.summary}</p>}
        <dl className="grid grid-cols-2 gap-3">
          <Info label="Suggested category" value={ai.category ?? '—'} />
          <Info label="Suggested priority" value={ai.priority ?? '—'} />
          <Info label="Suggested department" value={ai.recommendedDepartment?.name ?? '—'} />
          <Info
            label="Decision"
            value={
              routedAutomatically
                ? 'Routed automatically'
                : ticket.department
                  ? 'Confirmed by an administrator'
                  : 'Waiting for an administrator'
            }
          />
        </dl>
        <p className="text-xs text-slate-600">
          Suggestions are checked by the routing rules; anything uncertain is confirmed by a person.
        </p>
      </div>
    </Card>
  );
}

/** Placeholder layout while the ticket loads. */
function TicketSkeleton() {
  return (
    <SkeletonGroup label="Loading ticket…">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-8 w-2/3" />
      <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </SkeletonGroup>
  );
}
