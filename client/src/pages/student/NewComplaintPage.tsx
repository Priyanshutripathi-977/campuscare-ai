/**
 * The complaint form. Validates instantly in the browser with the same rules the
 * server uses, then sends text + optional photo together. Shows the ticket ID on success.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CATEGORIES,
  CreateTicketSchema,
  fieldErrors,
  UPLOAD_ALLOWED_MIME_TYPES,
  type TicketDetailDTO,
} from '@campuscare/shared';
import { createTicket } from '../../api/tickets';
import { ApiError } from '../../api/client';
import { PageHeader } from '../../components/AppLayout';
import { Button, ButtonLink } from '../../components/ui/Button';
import { SelectField, TextArea, TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';

export const MAX_IMAGE_MB = 5;

const EMPTY = { title: '', description: '', building: '', room: '', details: '', category: '' };

export function NewComplaintPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<TicketDetailDTO | null>(null);

  /** Stores the chosen photo and builds a thumbnail preview for it. */
  const chooseImage = (file: File | null) => {
    setImage(file);
    setPreview(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const mutation = useMutation({
    mutationFn: ({
      input,
      file,
    }: {
      input: Parameters<typeof createTicket>[0];
      file: File | null;
    }) => createTicket(input, file),
    onSuccess: (ticket) => {
      setCreated(ticket);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      window.scrollTo({ top: 0 });
    },
    onError: (err) =>
      setErrors(
        err instanceof ApiError
          ? { ...err.fieldErrors, _form: err.message }
          : { _form: 'Submission failed' },
      ),
  });

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    const { image: _old, ...rest } = errors;
    if (file && !(UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      setErrors({ ...rest, image: 'Image must be a JPG, PNG or WebP file' });
      e.target.value = '';
      return chooseImage(null);
    }
    if (file && file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setErrors({ ...rest, image: `Image is too large (max ${MAX_IMAGE_MB} MB)` });
      e.target.value = '';
      return chooseImage(null);
    }
    setErrors(rest);
    chooseImage(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      title: form.title,
      description: form.description,
      location: { building: form.building, room: form.room, details: form.details },
      category: form.category,
    };
    const parsed = CreateTicketSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      // Move keyboard focus to the first invalid field.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    mutation.mutate({ input: parsed.data, file: image });
  };

  if (created) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <div role="status" className="text-center">
            <div
              aria-hidden
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700"
            >
              ✓
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Complaint submitted</h1>
            <p className="mt-2 text-sm text-slate-600">Your ticket ID is</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-wide text-brand-700">
              {created.ticketId}
            </p>
            <SubmissionOutcome ticket={created} />
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink to={`/tickets/${created.ticketId}`}>View ticket</ButtonLink>
              <Button
                variant="secondary"
                onClick={() => {
                  setCreated(null);
                  setForm(EMPTY);
                  chooseImage(null);
                  mutation.reset();
                }}
              >
                Report another problem
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Report a problem"
        description="Describe what's wrong and where. Fields marked * are required."
      />
      <form onSubmit={submit} noValidate>
        <Card>
          <div className="space-y-5">
            {errors._form && <Alert tone="error">{errors._form}</Alert>}
            <TextField
              label="Short title"
              required
              maxLength={120}
              value={form.title}
              onChange={set('title')}
              error={errors.title}
              placeholder="e.g. Projector not working in LH-5"
            />
            <TextArea
              label="Description"
              required
              rows={5}
              maxLength={2000}
              value={form.description}
              onChange={set('description')}
              error={errors.description}
              hint={`${form.description.trim().length}/2000 characters · What happened, since when, and how it affects you.`}
            />
            <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-800">Location</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Building / area"
                  required
                  maxLength={80}
                  value={form.building}
                  onChange={set('building')}
                  error={errors['location.building']}
                  placeholder="e.g. Engineering Block A"
                />
                <TextField
                  label="Room / spot"
                  maxLength={40}
                  value={form.room}
                  onChange={set('room')}
                  error={errors['location.room']}
                  placeholder="e.g. Lab 3"
                />
              </div>
              <TextField
                label="Landmark or extra details"
                maxLength={200}
                value={form.details}
                onChange={set('details')}
                error={errors['location.details']}
                placeholder="e.g. near the north staircase"
              />
            </fieldset>
            <SelectField
              label="Category"
              value={form.category}
              onChange={set('category')}
              error={errors.category}
              hint="Not sure? Leave it — the administration will choose the right category."
            >
              <option value="">Not sure — let the system decide</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectField>
            <div>
              <label htmlFor="image" className="block text-sm font-medium text-slate-800">
                Photo <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="image"
                type="file"
                accept={UPLOAD_ALLOWED_MIME_TYPES.join(',')}
                onChange={onFile}
                aria-describedby="image-hint image-error"
                aria-invalid={Boolean(errors.image) || undefined}
                className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              <p id="image-hint" className="mt-1 text-xs text-slate-500">
                JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB.
              </p>
              {errors.image && (
                <p id="image-error" className="mt-1 text-sm text-red-700">
                  {errors.image}
                </p>
              )}
              {preview && (
                <div className="mt-3 flex items-start gap-3">
                  <img
                    src={preview}
                    alt="Selected photo preview"
                    className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      chooseImage(null);
                      (document.getElementById('image') as HTMLInputElement).value = '';
                    }}
                  >
                    Remove photo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
        <div className="mt-4 flex justify-end gap-2">
          <ButtonLink to="/student" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" loading={mutation.isPending}>
            Submit complaint
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Explains honestly what happened to the complaint after submission. */
function SubmissionOutcome({ ticket }: { ticket: TicketDetailDTO }) {
  const asking = ticket.ai && 'needsClarification' in ticket.ai && ticket.ai.needsClarification;
  if (ticket.status === 'Assigned' && ticket.department) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        It has been sent to <strong>{ticket.department.name}</strong> ({ticket.category},{' '}
        {ticket.priority} priority).
      </p>
    );
  }
  if (asking) {
    return (
      <div className="mt-4 text-left">
        <Alert tone="warning" title="We need a few more details">
          {ticket.ai && 'clarificationQuestion' in ticket.ai
            ? ticket.ai.clarificationQuestion
            : null}{' '}
          Open the ticket and add an update to answer.
        </Alert>
      </div>
    );
  }
  return (
    <p className="mt-4 text-sm text-slate-600">
      Current status: <strong>{ticket.status}</strong>. An administrator will confirm the category
      and priority and route it to the right department. You can follow every step on the ticket
      page.
    </p>
  );
}
