/** The conversation on a ticket + a form to add a new update. */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AddUpdateSchema, fieldErrors, type TicketDetailDTO } from '@campuscare/shared';
import { addUpdate } from '../../api/tickets';
import { ApiError } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Field';
import { Alert } from '../ui/Alert';

export function UpdatesThread({ ticket }: { ticket: TicketDetailDTO }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();

  const mutation = useMutation({
    mutationFn: (msg: string) => addUpdate(ticket.ticketId, msg),
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticket', ticket.ticketId], updated);
      setMessage('');
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? (err.fieldErrors.message ?? err.message)
          : 'Could not post update',
      ),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = AddUpdateSchema.safeParse({ message });
    if (!parsed.success) return setError(fieldErrors(parsed.error).message);
    setError(undefined);
    mutation.mutate(parsed.data.message);
  };

  return (
    <div>
      {ticket.updates.length === 0 ? (
        <p className="text-sm text-slate-500">No updates yet.</p>
      ) : (
        <ul className="space-y-3">
          {ticket.updates.map((u) => (
            <li
              key={u.id}
              className={`rounded-lg p-3 text-sm ${u.author?.role === 'student' ? 'bg-slate-50' : 'bg-brand-50'}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {u.author?.name ?? 'Unknown'}{' '}
                  <span className="font-normal text-slate-500">({u.author?.role})</span>
                </span>
                <time className="text-xs text-slate-500" dateTime={u.at}>
                  {formatDateTime(u.at)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{u.message}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 space-y-2" noValidate>
        <TextArea
          label="Add an update"
          required
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          error={error}
          hint="Share new details, photos you forgot to mention, or questions."
        />
        {mutation.isSuccess && !message && <Alert tone="success">Update posted.</Alert>}
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            Post update
          </Button>
        </div>
      </form>
    </div>
  );
}
