/**
 * The complaint form. Validates instantly in the browser with the same rules the
 * server uses, then sends text + optional photo together. While the server saves and
 * analyses the complaint, an honest progress panel is shown; afterwards the REAL result
 * from the server (status, category, priority, department, summary) is displayed.
 */
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Camera,
  CheckCircle2,
  ClipboardCopy,
  Cpu,
  Droplets,
  HelpCircle,
  Lightbulb,
  MapPin,
  Monitor,
  Presentation,
  Shield,
  Sparkles,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  CATEGORIES,
  CreateTicketSchema,
  fieldErrors,
  type Category,
  type TicketDetailDTO,
} from '@campuscare/shared';
import { createTicket } from '../../api/tickets';
import { ApiError } from '../../api/client';
import { PageHeader } from '../../components/AppLayout';
import { Button, ButtonLink } from '../../components/ui/Button';
import { TextArea, TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { Dropzone } from '../../components/ui/Dropzone';
import { useToast } from '../../components/ui/Toast';
import { Tooltip } from '../../components/ui/Tooltip';
import { PriorityBadge, StatusBadge } from '../../components/tickets/Badges';

export const MAX_IMAGE_MB = 5;

const EMPTY = { title: '', description: '', building: '', room: '', details: '', category: '' };

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  IT: Monitor,
  Electrical: Zap,
  Plumbing: Droplets,
  Housekeeping: Trash2,
  'Classroom Facilities': Presentation,
  Security: Shield,
  Other: HelpCircle,
};

export function NewComplaintPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<TicketDetailDTO | null>(null);
  // Set synchronously, so even two submits in the same instant only send ONE complaint.
  const submitting = useRef(false);

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
    onSettled: () => {
      submitting.current = false;
    },
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
    (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return; // a submission is already on its way
    const input = {
      title: form.title,
      description: form.description,
      location: { building: form.building, room: form.room, details: form.details },
      category: form.category,
    };
    const parsed = CreateTicketSchema.safeParse(input);
    if (!parsed.success) {
      setErrors({ ...fieldErrors(parsed.error), ...(errors.image ? { image: errors.image } : {}) });
      // Move keyboard focus to the first invalid field.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    submitting.current = true;
    mutation.mutate({ input: parsed.data, file: image });
  };

  const reset = () => {
    setCreated(null);
    setForm(EMPTY);
    chooseImage(null);
    setErrors({});
    mutation.reset();
  };

  if (created) return <SubmissionResult ticket={created} onAnother={reset} />;

  const descLength = form.description.trim().length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="New complaint"
        title="Report a problem"
        description="Describe what's wrong and where. Fields marked * are required."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <form
          onSubmit={submit}
          noValidate
          className="space-y-6"
          aria-busy={mutation.isPending || undefined}
        >
          {/* All fields are disabled while the complaint is being sent. */}
          <fieldset disabled={mutation.isPending} className="m-0 min-w-0 space-y-6 border-0 p-0">
            {errors._form && <Alert tone="error">{errors._form}</Alert>}

            <Card title="What's the problem?" icon={Lightbulb}>
              <div className="space-y-5">
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
                  hint={
                    <span className="flex justify-between gap-2">
                      <span>What happened, since when, and how it affects you.</span>
                      <span className={descLength > 0 && descLength < 20 ? 'text-amber-700' : ''}>
                        {descLength}/2000
                      </span>
                    </span>
                  }
                />
                <CategoryPicker
                  value={form.category}
                  onChange={(category) => setForm({ ...form, category })}
                  error={errors.category}
                />
              </div>
            </Card>

            <Card title="Where is it?" icon={MapPin}>
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
                <div className="sm:col-span-2">
                  <TextField
                    label="Landmark or extra details"
                    maxLength={200}
                    value={form.details}
                    onChange={set('details')}
                    error={errors['location.details']}
                    placeholder="e.g. near the north staircase"
                  />
                </div>
              </div>
            </Card>

            <Card
              title="Add a photo"
              icon={Camera}
              description="Optional, but it helps staff understand the problem faster."
            >
              <Dropzone
                file={image}
                previewUrl={preview}
                onFile={chooseImage}
                onError={(msg) => {
                  const { image: _old, ...rest } = errors;
                  setErrors(msg ? { ...rest, image: msg } : rest);
                }}
                maxMb={MAX_IMAGE_MB}
                error={errors.image}
              />
            </Card>

            {mutation.isPending ? (
              <AnalysingPanel />
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <ButtonLink to="/student" variant="secondary">
                  Cancel
                </ButtonLink>
                <Button type="submit" size="lg" icon={Sparkles}>
                  Submit complaint
                </Button>
              </div>
            )}
          </fieldset>
        </form>

        <aside className="grid gap-4 sm:grid-cols-2 xl:sticky xl:top-24 xl:block xl:space-y-4 xl:self-start">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <p className="text-sm font-semibold text-navy-900">Tips for a quick fix</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {[
                'Say exactly where it is (building, room, landmark).',
                'Mention safety risks: sparks, smoke, water near sockets.',
                'Say since when it has been a problem.',
                'One problem per complaint.',
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-700 shadow-card">
            <p className="font-semibold text-navy-900">What happens next?</p>
            <p className="mt-2">
              Your complaint is saved first, then analysed to suggest a category and priority.
              Clear, confident cases go straight to the right department; anything uncertain or
              urgent is checked by an administrator.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Category chips — real radio buttons underneath, so keyboard and screen readers work. */
function CategoryPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const options: { value: string; label: string; icon: LucideIcon }[] = [
    { value: '', label: 'Not sure — let the system decide', icon: Bot },
    ...CATEGORIES.map((c) => ({ value: c, label: c, icon: CATEGORY_ICONS[c] })),
  ];
  return (
    <fieldset>
      <legend className="text-sm font-medium text-navy-800">
        Category <span className="font-normal text-slate-600">(optional)</span>
      </legend>
      <p className="mt-0.5 text-xs text-slate-600">
        Not sure? Leave it — the category will be suggested for you.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(({ value: v, label, icon: Icon }) => {
          const checked = value === v;
          return (
            <label
              key={label}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/25 ${
                checked
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="category"
                value={v}
                checked={checked}
                onChange={() => onChange(v)}
                className="sr-only"
              />
              <Icon
                aria-hidden
                className={`h-4 w-4 ${checked ? 'text-brand-600' : 'text-slate-500'}`}
              />
              {label}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}

/**
 * Shown while the single submit request runs. The server does not report progress step by
 * step, so the steps are listed as "what is happening" — none is ticked until it is done.
 */
function AnalysingPanel() {
  return (
    <div
      role="status"
      className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-card animate-fade-in"
    >
      <div className="h-1 w-full overflow-hidden bg-brand-100">
        <div className="progress-indeterminate h-full w-1/3 rounded-full bg-brand-500" />
      </div>
      <div className="flex items-start gap-4 p-5">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white animate-pulse-ring"
        >
          <Cpu className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-navy-900">Submitting and analysing your complaint…</p>
          <p className="mt-0.5 text-sm text-slate-600">
            This usually takes a few seconds. Please keep this page open.
          </p>
          <ol className="mt-3 space-y-1.5 text-sm text-slate-700">
            {[
              'Saving your complaint (it is never lost, even if analysis fails)',
              'Suggesting a category and priority',
              'Applying the routing rules and checking for duplicates',
            ].map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** The real outcome returned by the server, revealed step by step. */
function SubmissionResult({
  ticket,
  onAnother,
}: {
  ticket: TicketDetailDTO;
  onAnother: () => void;
}) {
  const toast = useToast();
  const ai = ticket.ai && ticket.ai.view === 'student' ? ticket.ai : null;
  const routed = ticket.status === 'Assigned' && ticket.department;
  const suggestedDept = ticket.department?.name ?? ai?.recommendedDepartment?.name ?? null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ticket.ticketId);
      toast({ tone: 'success', title: 'Ticket ID copied', description: ticket.ticketId });
    } catch {
      toast({
        tone: 'error',
        title: 'Could not copy',
        description: 'Please copy the ticket ID manually.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div
        role="status"
        className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-card animate-scale-in sm:p-8"
      >
        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        >
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-navy-900">Complaint submitted</h1>
        <p className="mt-2 text-sm text-slate-600">Your ticket ID is</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="font-mono text-2xl font-semibold tracking-wide text-brand-700">
            {ticket.ticketId}
          </p>
          <Tooltip label="Copy to clipboard">
            <button
              type="button"
              onClick={copy}
              aria-label="Copy ticket ID"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700"
            >
              <ClipboardCopy aria-hidden className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <section
        aria-labelledby="analysis-title"
        className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card animate-slide-up [animation-delay:120ms]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="analysis-title" className="font-semibold text-navy-900">
            Analysis result
          </h2>
          {ai && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {ai.source === 'gemini' ? (
                <Sparkles aria-hidden className="h-3.5 w-3.5 text-brand-600" />
              ) : (
                <Cpu aria-hidden className="h-3.5 w-3.5" />
              )}
              {ai.source === 'gemini'
                ? 'Analysed by Gemini AI'
                : 'Analysed by the keyword classifier'}
            </span>
          )}
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <ResultRow label="Status" delay={160}>
            <StatusBadge status={ticket.status} />
          </ResultRow>
          <ResultRow label={routed ? 'Category' : 'Suggested category'} delay={220}>
            <span className="font-medium text-navy-900">{ticket.category ?? 'Not determined'}</span>
          </ResultRow>
          <ResultRow label={routed ? 'Priority' : 'Suggested priority'} delay={280}>
            <PriorityBadge priority={ticket.priority} />
          </ResultRow>
          <ResultRow label={routed ? 'Sent to' : 'Suggested department'} delay={340}>
            <span className="font-medium text-navy-900">
              {suggestedDept ?? 'To be decided by an administrator'}
            </span>
          </ResultRow>
          {ai?.summary && (
            <div className="sm:col-span-2">
              <ResultRow label="Summary" delay={400}>
                <span className="text-slate-700">{ai.summary}</span>
              </ResultRow>
            </div>
          )}
        </dl>

        <div className="mt-5 animate-fade-in [animation-delay:460ms]">
          {ai?.needsClarification ? (
            <Alert tone="warning" title="We need a few more details">
              {ai.clarificationQuestion} Open the ticket and add an update to answer — it will be
              checked again automatically.
            </Alert>
          ) : routed ? (
            <Alert tone="success" title={`Sent to ${ticket.department!.name}`}>
              Your complaint was routed automatically. You'll be notified as it progresses.
            </Alert>
          ) : (
            <Alert tone="info" title="An administrator will review it">
              The suggestion above still needs to be confirmed
              {ai?.source === 'fallback_rules'
                ? ' (it came from the simple keyword classifier, not AI)'
                : ''}
              . You'll be notified when it is routed to a department.
            </Alert>
          )}
        </div>
      </section>

      <div className="flex flex-wrap justify-center gap-2">
        <ButtonLink to={`/tickets/${ticket.ticketId}`}>View ticket</ButtonLink>
        <Button variant="secondary" onClick={onAnother}>
          Report another problem
        </Button>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  children,
  delay,
}: {
  label: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <div
      className="rounded-xl bg-slate-50 p-3 animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
