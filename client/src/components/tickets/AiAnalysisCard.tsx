/**
 * Shows staff/admin what the AI concluded and why — and makes clear it is a suggestion.
 * Admins can re-run the analysis while a ticket is still under review.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AiAnalysisDTO, TicketDetailDTO } from '@campuscare/shared';
import { reanalyzeTicket } from '../../api/tickets';
import { aiErrorLabel, formatDateTime } from '../../lib/format';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { TagBadge } from './Badges';

export const isFullAi = (ai: TicketDetailDTO['ai']): ai is AiAnalysisDTO =>
  Boolean(ai && 'source' in ai);

export function AiAnalysisCard({
  ticket,
  canRerun,
}: {
  ticket: TicketDetailDTO;
  canRerun: boolean;
}) {
  const queryClient = useQueryClient();
  const ai = isFullAi(ticket.ai) ? ticket.ai : null;
  const rerun = useMutation({
    mutationFn: () => reanalyzeTicket(ticket.ticketId),
    onSuccess: (t) => {
      queryClient.setQueryData(['ticket', ticket.ticketId], t);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
  const rerunAllowed =
    canRerun && (ticket.status === 'Under Review' || ticket.status === 'Submitted');

  return (
    <div className="space-y-4 text-sm">
      {!ai ? (
        <p className="text-slate-500">No AI analysis for this ticket.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <TagBadge tone={ai.source === 'gemini' ? 'violet' : 'slate'}>
              {ai.source === 'gemini' ? `Gemini · ${ai.model}` : 'Keyword fallback'}
            </TagBadge>
            {ai.confidence !== null && <ConfidenceMeter value={ai.confidence} />}
            {ai.safetyRisk && <TagBadge tone="red">Safety risk</TagBadge>}
          </div>
          {ai.error && ai.error !== 'not_configured' && (
            <Alert tone="warning">
              AI problem: {aiErrorLabel(ai.error)}. The keyword classifier was used instead.
            </Alert>
          )}
          {ai.summary && <p className="text-slate-800">{ai.summary}</p>}
          <dl className="space-y-2">
            <Row label="Suggested">{`${ai.category} · ${ai.priority}${ai.recommendedDepartment ? ` → ${ai.recommendedDepartment.name}` : ''}`}</Row>
            {ai.categoryReason && <Row label="Why this category">{ai.categoryReason}</Row>}
            {ai.priorityReason && <Row label="Why this priority">{ai.priorityReason}</Row>}
            {(ai.extractedLocation?.building || ai.extractedLocation?.room) && (
              <Row label="Location found">
                {[ai.extractedLocation.building, ai.extractedLocation.room]
                  .filter(Boolean)
                  .join(' · ')}
              </Row>
            )}
            {ai.keyDetails.length > 0 && (
              <Row label="Key details">
                <ul className="list-inside list-disc">
                  {ai.keyDetails.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </Row>
            )}
            {ai.needsClarification && ai.clarificationQuestion && (
              <Row label="Asked the student">“{ai.clarificationQuestion}”</Row>
            )}
          </dl>
          <p className="text-xs text-slate-500">
            Analysed {formatDateTime(ai.processedAt)}. AI output is a suggestion — routing follows
            the configured rules.
          </p>
        </>
      )}
      {rerunAllowed && (
        <div>
          {rerun.isError && <Alert tone="error">{rerun.error.message}</Alert>}
          <Button
            variant="secondary"
            size="sm"
            loading={rerun.isPending}
            onClick={() => rerun.mutate()}
          >
            Re-run AI analysis
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}

/** Confidence as a small meter + number (never colour alone). */
function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-600">
      <span
        className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="AI confidence"
      >
        <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${pct}%` }} />
      </span>
      {pct}% confident
    </span>
  );
}
