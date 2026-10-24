/**
 * Review queue for possible duplicate complaints. The system only SUGGESTS pairs;
 * an admin decides. Confirming links the newer ticket to the original — both stay open.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DuplicateSuggestionDTO, TicketSummaryDTO } from '@campuscare/shared';
import { decideDuplicate, listDuplicates, type DuplicateTab } from '../../api/admin';
import { formatDateTime, formatLocation, relativeTime } from '../../lib/format';
import { PageHeader } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { DemoBadge, StatusBadge, TagBadge } from '../../components/tickets/Badges';

const TABS: { id: DuplicateTab; label: string }[] = [
  { id: 'pending', label: 'To review' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'dismissed', label: 'Dismissed' },
];

export function DuplicatesPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('status'))?.id ?? 'pending') as DuplicateTab;
  const page = Number(params.get('page') ?? 1) || 1;
  const list = useQuery({
    queryKey: ['duplicates', tab, page],
    queryFn: () => listDuplicates(tab, page),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Possible duplicates"
        description="Complaints that look like an existing open complaint. Confirming links them so they are handled together — nothing is merged, closed or deleted."
      />
      <div
        role="tablist"
        aria-label="Suggestion status"
        className="mb-4 flex gap-1 border-b border-slate-200"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'pending' ? {} : { status: t.id })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.isPending ? (
        <PageLoader label="Loading suggestions…" />
      ) : list.isError ? (
        <ErrorState
          title="Could not load suggestions"
          error={list.error}
          onRetry={() => list.refetch()}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={tab === 'pending' ? 'Nothing to review' : `No ${tab} suggestions`}
          description={
            tab === 'pending'
              ? 'New complaints are compared with recent open ones automatically.'
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {list.data.items.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
          <Pagination
            page={list.data.page}
            pages={list.data.pages}
            total={list.data.total}
            onChange={(p) =>
              setParams({ ...(tab !== 'pending' ? { status: tab } : {}), page: String(p) })
            }
          />
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion: s }: { suggestion: DuplicateSuggestionDTO }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (decision: 'confirmed' | 'dismissed') =>
      decideDuplicate(s.id, decision, note.trim() || undefined),
    onSuccess: () => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      void queryClient.invalidateQueries({ queryKey: ['ticket'] });
    },
  });
  const pct = Math.round(s.score * 100);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-900">{pct}% match</span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${pct}%` }} />
          </span>
          {s.reasons.map((r) => (
            <TagBadge key={r}>{r}</TagBadge>
          ))}
        </div>
        <span className="text-xs text-slate-500">Suggested {relativeTime(s.createdAt)}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <TicketBox label="New complaint" ticket={s.ticket} />
        <TicketBox label="Possible original" ticket={s.candidate} />
      </div>

      {s.status === 'pending' ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {decide.isError && <Alert tone="error">{decide.error.message}</Alert>}
          <Button
            variant="secondary"
            loading={decide.isPending && decide.variables === 'dismissed'}
            onClick={() => decide.mutate('dismissed')}
          >
            Not a duplicate
          </Button>
          <Button
            onClick={() => {
              setNote('');
              decide.reset();
              setConfirming(true);
            }}
          >
            Confirm duplicate
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">
          {s.status === 'confirmed' ? 'Confirmed' : 'Dismissed'} by{' '}
          {s.reviewedBy?.name ?? 'an admin'}
          {s.reviewedAt && ` on ${formatDateTime(s.reviewedAt)}`}
          {s.note && ` — “${s.note}”`}
        </p>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirm duplicate"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button loading={decide.isPending} onClick={() => decide.mutate('confirmed')}>
              Link as duplicate
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {decide.isError && <Alert tone="error">{decide.error.message}</Alert>}
          <p>
            <strong>{s.ticket.ticketId}</strong> will be linked as a duplicate of{' '}
            <strong>{s.candidate.ticketId}</strong>. The student is told in the ticket conversation.
            Both tickets stay open.
          </p>
          <TextField
            label="Note to the student"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint="Optional, e.g. “Same fan — the technician is already on it.”"
          />
        </div>
      </Modal>
    </article>
  );
}

function TicketBox({ label, ticket }: { label: string; ticket: TicketSummaryDTO }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <Link
        to={`/tickets/${ticket.ticketId}`}
        className="mt-1 block font-medium text-slate-900 hover:text-brand-700 hover:underline"
      >
        {ticket.title}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="font-mono">{ticket.ticketId}</span>
        <StatusBadge status={ticket.status} />
        {ticket.category && <span>{ticket.category}</span>}
        {ticket.isDemo && <DemoBadge />}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {formatLocation(ticket.location)} · {relativeTime(ticket.createdAt)}
      </p>
    </div>
  );
}
