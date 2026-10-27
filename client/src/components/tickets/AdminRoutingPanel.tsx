/**
 * Admin tools on a ticket: (1) set category + priority, (2) assign/reassign to a
 * department and optionally a staff member. Assignment is enabled once classified.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type Priority,
  type TicketDetailDTO,
} from '@campuscare/shared';
import { assignTicket, classifyTicket } from '../../api/tickets';
import { getDepartments, getStaff } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { Alert } from '../ui/Alert';
import { useToast } from '../ui/Toast';
import { Sparkles } from 'lucide-react';
import { isFullAi } from './AiAnalysisCard';

export function AdminRoutingPanel({ ticket }: { ticket: TicketDetailDTO }) {
  const locked = ticket.status === 'Resolved';
  return (
    <div className="space-y-6">
      {locked && <Alert tone="info">Resolved tickets cannot be reclassified or reassigned.</Alert>}
      {!locked && <AcceptSuggestion ticket={ticket} />}
      <ClassifyForm ticket={ticket} disabled={locked} />
      <hr className="border-slate-200" />
      <AssignForm ticket={ticket} disabled={locked} />
    </div>
  );
}

/**
 * One-click review for uncertain tickets: accepts the AI/keyword suggestion by calling the
 * SAME classify + assign endpoints an admin would use by hand. Only shown while the ticket is
 * waiting for review and the suggestion maps to a department.
 */
function AcceptSuggestion({ ticket }: { ticket: TicketDetailDTO }) {
  const onUpdated = useTicketUpdater(ticket.ticketId);
  const toast = useToast();
  const ai = isFullAi(ticket.ai) ? ticket.ai : null;
  const dept = ai?.recommendedDepartment;
  const accept = useMutation({
    mutationFn: async () => {
      await classifyTicket(ticket.ticketId, { category: ai!.category!, priority: ai!.priority! });
      return assignTicket(ticket.ticketId, {
        departmentId: dept!.id,
        note: 'Suggestion accepted by an administrator',
      });
    },
    onSuccess: (t) => {
      onUpdated(t);
      toast({
        tone: 'success',
        title: 'Suggestion accepted',
        description: `${t.ticketId} assigned to ${dept!.name}.`,
      });
    },
  });
  if (!ai || !dept || !ai.category || !ai.priority || ticket.department || !ticket.needsReview)
    return null;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
        <Sparkles aria-hidden className="h-4 w-4 text-brand-600" />
        Suggested routing
      </p>
      <p className="mt-1 text-sm text-slate-700">
        <strong>{ai.category}</strong> · <strong>{ai.priority}</strong> →{' '}
        <strong>{dept.name}</strong>
        <span className="text-slate-600">
          {' '}
          ({ai.source === 'gemini' ? 'Gemini' : 'keyword classifier'}
          {ai.confidence !== null && `, ${Math.round(ai.confidence * 100)}% confident`})
        </span>
      </p>
      {accept.isError && (
        <div className="mt-2">
          <Alert tone="error">{accept.error.message}</Alert>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate()}>
          Accept suggestion & assign
        </Button>
        <span className="self-center text-xs text-slate-600">or change it below</span>
      </div>
    </div>
  );
}

function useTicketUpdater(ticketId: string) {
  const queryClient = useQueryClient();
  return (updated: TicketDetailDTO) => {
    queryClient.setQueryData(['ticket', ticketId], updated);
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  };
}

function ClassifyForm({ ticket, disabled }: { ticket: TicketDetailDTO; disabled: boolean }) {
  const onUpdated = useTicketUpdater(ticket.ticketId);
  const [category, setCategory] = useState<Category | ''>(
    ticket.category ?? ticket.studentCategory ?? '',
  );
  const [priority, setPriority] = useState<Priority | ''>(ticket.priority ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      classifyTicket(ticket.ticketId, {
        category: category as Category,
        priority: priority as Priority,
      }),
    onSuccess: (t) => {
      setErrors({});
      onUpdated(t);
    },
    onError: (err) =>
      setErrors(
        err instanceof ApiError
          ? { ...err.fieldErrors, _form: err.message }
          : { _form: 'Failed to save' },
      ),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!category) errs.category = 'Choose a category';
    if (!priority) errs.priority = 'Choose a priority';
    if (Object.keys(errs).length) return setErrors(errs);
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">1. Classification</h3>
      {ticket.studentCategory && (
        <p className="text-xs text-slate-500">
          Student suggested: <strong>{ticket.studentCategory}</strong>
        </p>
      )}
      {errors._form && <Alert tone="error">{errors._form}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Category"
          required
          value={category}
          disabled={disabled}
          onChange={(e) => setCategory(e.target.value as Category)}
          error={errors.category}
        >
          <option value="">Select…</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        <SelectField
          label="Priority"
          required
          value={priority}
          disabled={disabled}
          onChange={(e) => setPriority(e.target.value as Priority)}
          error={errors.priority}
        >
          <option value="">Select…</option>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </SelectField>
      </div>
      {mutation.isSuccess && <Alert tone="success">Classification saved. Deadline updated.</Alert>}
      <Button type="submit" variant="secondary" loading={mutation.isPending} disabled={disabled}>
        Save classification
      </Button>
    </form>
  );
}

function AssignForm({ ticket, disabled }: { ticket: TicketDetailDTO; disabled: boolean }) {
  const onUpdated = useTicketUpdater(ticket.ticketId);
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: 5 * 60_000,
  });

  // Suggest the department mapped to the ticket's category (admin can still change it).
  const suggested = departments.data?.find(
    (d) => ticket.category && d.categories.includes(ticket.category),
  );
  const [departmentId, setDepartmentId] = useState(ticket.department?.id ?? '');
  const effectiveDept = departmentId || suggested?.id || '';
  const [assignedTo, setAssignedTo] = useState(ticket.assignedTo?.id ?? '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const staff = useQuery({
    queryKey: ['staff', effectiveDept],
    queryFn: () => getStaff(effectiveDept),
    enabled: Boolean(effectiveDept),
  });

  const mutation = useMutation({
    mutationFn: () =>
      assignTicket(ticket.ticketId, {
        departmentId: effectiveDept,
        assignedTo: assignedTo || null,
        note: note.trim() || undefined,
      }),
    onSuccess: (t) => {
      setErrors({});
      setNote('');
      onUpdated(t);
    },
    onError: (err) =>
      setErrors(
        err instanceof ApiError
          ? { ...err.fieldErrors, _form: err.message }
          : { _form: 'Failed to assign' },
      ),
  });

  const notClassified = !ticket.category || !ticket.priority;
  const isReassign = Boolean(ticket.department);
  // Remember what the last submit did, so the success message doesn't flip after the ticket updates.
  const [lastAction, setLastAction] = useState<'assigned' | 'reassigned'>('assigned');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveDept) return setErrors({ departmentId: 'Choose a department' });
    setLastAction(isReassign ? 'reassigned' : 'assigned');
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">
        2. {isReassign ? 'Reassign' : 'Assign'}
      </h3>
      {notClassified && <Alert tone="info">Save a category and priority first.</Alert>}
      {departments.isError && (
        <Alert tone="error">Could not load departments: {departments.error.message}</Alert>
      )}
      {errors._form && <Alert tone="error">{errors._form}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Department"
          required
          value={effectiveDept}
          disabled={disabled || notClassified || departments.isPending}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setAssignedTo('');
          }}
          error={errors.departmentId}
          hint={
            suggested && !ticket.department
              ? `Suggested from category: ${suggested.name}`
              : undefined
          }
        >
          <option value="">{departments.isPending ? 'Loading…' : 'Select…'}</option>
          {departments.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Staff member"
          value={assignedTo}
          disabled={disabled || notClassified || !effectiveDept || staff.isPending}
          onChange={(e) => setAssignedTo(e.target.value)}
          error={errors.assignedTo}
        >
          <option value="">Anyone in the department</option>
          {staff.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        label="Routing note"
        value={note}
        maxLength={300}
        disabled={disabled || notClassified}
        onChange={(e) => setNote(e.target.value)}
        hint="Why this department? Saved with the routing decision."
      />
      {mutation.isSuccess && <Alert tone="success">Ticket {lastAction}.</Alert>}
      <Button type="submit" loading={mutation.isPending} disabled={disabled || notClassified}>
        {isReassign ? 'Reassign ticket' : 'Assign ticket'}
      </Button>
    </form>
  );
}
