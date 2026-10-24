/**
 * Status buttons for staff/admin. Only transitions the server allows for this role are shown.
 * Every change opens a dialog; resolving requires a note AND an explicit confirmation.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  type Role,
  type Status,
  type TicketDetailDTO,
} from '@campuscare/shared';
import { changeStatus } from '../../api/tickets';
import { ApiError } from '../../api/client';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TextArea } from '../ui/Field';
import { Alert } from '../ui/Alert';

const ACTION_LABELS: Partial<Record<Status, string>> = {
  'In Progress': 'Start work',
  Resolved: 'Mark as resolved',
  'Under Review': 'Send back for review',
};

export function StatusActions({ ticket, role }: { ticket: TicketDetailDTO; role: Role }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Status | null>(null);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const options = ALLOWED_TRANSITIONS[ticket.status].filter((to) =>
    canTransition(role, ticket.status, to),
  );

  const mutation = useMutation({
    mutationFn: () =>
      changeStatus(ticket.ticketId, {
        status: target!,
        note: note.trim() || undefined,
        confirm: target === 'Resolved' ? confirmed : undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', ticket.ticketId], updated);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      close();
    },
    onError: (err) =>
      setErrors(
        err instanceof ApiError
          ? { ...err.fieldErrors, _form: err.message }
          : { _form: 'Could not update status' },
      ),
  });

  const open = (to: Status) => {
    setTarget(to);
    setNote('');
    setConfirmed(false);
    setErrors({});
  };
  const close = () => setTarget(null);

  const submit = () => {
    if (target === 'Resolved') {
      const errs: Record<string, string> = {};
      if (note.trim().length < 5)
        errs.note = 'Describe how the problem was resolved (at least 5 characters)';
      if (!confirmed) errs.confirm = 'Please confirm the problem is actually fixed';
      if (Object.keys(errs).length) return setErrors(errs);
    }
    mutation.mutate();
  };

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No status changes are available to you at this stage.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <Button
            key={to}
            variant={to === 'Resolved' ? 'primary' : 'secondary'}
            onClick={() => open(to)}
          >
            {ACTION_LABELS[to] ?? `Move to ${to}`}
          </Button>
        ))}
      </div>

      <Modal
        open={target !== null}
        onClose={close}
        title={target === 'Resolved' ? 'Confirm resolution' : `Change status to “${target}”`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit} loading={mutation.isPending}>
              {target === 'Resolved' ? 'Confirm & resolve' : 'Update status'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {errors._form && <Alert tone="error">{errors._form}</Alert>}
          {target === 'Resolved' && (
            <Alert tone="warning">
              The student will see this ticket as resolved. Only confirm once the problem is really
              fixed.
            </Alert>
          )}
          <TextArea
            label={target === 'Resolved' ? 'Resolution note' : 'Note'}
            required={target === 'Resolved'}
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={errors.note}
            hint={
              target === 'Resolved'
                ? 'What was done to fix it? The student can read this.'
                : 'Visible in the ticket history.'
            }
          />
          {target === 'Resolved' && (
            <div>
              <label className="flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-brand-600"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  aria-invalid={Boolean(errors.confirm) || undefined}
                />
                I confirm this problem has been resolved.
              </label>
              {errors.confirm && <p className="mt-1 text-sm text-red-700">{errors.confirm}</p>}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
