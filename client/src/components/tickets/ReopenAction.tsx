/** Lets the student who reported a resolved ticket reopen it, with a reason. */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fieldErrors, ReopenSchema, type TicketDetailDTO } from '@campuscare/shared';
import { reopenTicket } from '../../api/tickets';
import { ApiError } from '../../api/client';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TextArea } from '../ui/Field';
import { Alert } from '../ui/Alert';

export function ReopenAction({ ticket }: { ticket: TicketDetailDTO }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  const mutation = useMutation({
    mutationFn: (r: string) => reopenTicket(ticket.ticketId, r),
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', ticket.ticketId], updated);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setOpen(false);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? (err.fieldErrors.reason ?? err.message) : 'Could not reopen',
      ),
  });

  const submit = () => {
    const parsed = ReopenSchema.safeParse({ reason });
    if (!parsed.success) return setError(fieldErrors(parsed.error).reason);
    setError(undefined);
    mutation.mutate(parsed.data.reason);
  };

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm text-slate-600">Is the problem back or not properly fixed?</p>
        <Button
          variant="secondary"
          onClick={() => {
            setReason('');
            setError(undefined);
            setOpen(true);
          }}
        >
          Reopen this ticket
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reopen ticket"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={mutation.isPending}>
              Reopen ticket
            </Button>
          </>
        }
      >
        {mutation.isError && !error && <Alert tone="error">Could not reopen the ticket.</Alert>}
        <TextArea
          label="Why are you reopening it?"
          required
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={error}
        />
      </Modal>
    </>
  );
}
