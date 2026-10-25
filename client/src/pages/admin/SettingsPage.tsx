/**
 * Admin settings: AI routing rules, target resolution times, and the
 * category → department map. Everything here is saved on the server and used
 * immediately for new complaints.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type DepartmentDTO,
  type Priority,
  type SettingsDTO,
} from '@campuscare/shared';
import {
  getDepartments,
  getSettings,
  updateDepartmentCategories,
  updateSettings,
} from '../../api/admin';
import { ApiError } from '../../api/client';
import { PageHeader } from '../../components/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { ErrorState, PageLoader } from '../../components/ui/States';

export function SettingsPage() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const departments = useQuery({ queryKey: ['departments'], queryFn: getDepartments });

  if (settings.isPending || departments.isPending) return <PageLoader label="Loading settings…" />;
  if (settings.isError)
    return (
      <ErrorState
        title="Could not load settings"
        error={settings.error}
        onRetry={() => settings.refetch()}
      />
    );
  if (departments.isError)
    return (
      <ErrorState
        title="Could not load departments"
        error={departments.error}
        onRetry={() => departments.refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Control how complaints are classified, routed and timed. Changes apply to new and re-analysed complaints."
      />
      <Card title="AI classifier">
        {settings.data.ai.configured ? (
          <Alert tone="success">
            Gemini is configured (model: <strong>{settings.data.ai.provider}</strong>).
          </Alert>
        ) : (
          <Alert tone="info">
            No Gemini API key is configured, so the built-in keyword classifier is used and every
            complaint is reviewed by an administrator. Add <code>GEMINI_API_KEY</code> to the
            server's <code>.env</code> file and restart the server to enable AI.
          </Alert>
        )}
        <p className="mt-3 text-xs text-slate-500">
          The API key is stored only on the server. It is never sent to the browser.
        </p>
      </Card>
      <Card title="Email notifications">
        {settings.data.email.configured ? (
          <Alert tone="success">
            Email is configured. Notifications are also emailed; each one shows whether the email
            was really sent.
          </Alert>
        ) : (
          <Alert tone="info">
            Email is not configured, so notifications are in-app only. To enable email, set{' '}
            <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{' '}
            <code>SMTP_PASS</code> and <code>SMTP_FROM</code> in the server's <code>.env</code> and
            restart it.
          </Alert>
        )}
      </Card>
      {/* key= remounts the form with fresh values after a successful save */}
      <RulesForm key={JSON.stringify(settings.data.settings)} initial={settings.data.settings} />
      <Card title="Department routing map">
        <p className="mb-4 text-sm text-slate-600">
          Which department handles each category. A category can belong to only one department;
          uncheck it in one row before adding it to another.
        </p>
        <div className="divide-y divide-slate-100">
          {departments.data.map((d) => (
            <DepartmentRow key={`${d.id}-${d.categories.join()}`} department={d} />
          ))}
        </div>
        <UnmappedWarning departments={departments.data} />
      </Card>
    </div>
  );
}

function RulesForm({ initial }: { initial: SettingsDTO }) {
  const queryClient = useQueryClient();
  const [confidence, setConfidence] = useState(
    Math.round(initial.routing.autoRouteConfidence * 100),
  );
  const [reviewCritical, setReviewCritical] = useState(initial.routing.reviewCriticalPriority);
  const [reviewCategories, setReviewCategories] = useState<Category[]>(
    initial.routing.reviewCategories,
  );
  const [sla, setSla] = useState<Record<Priority, number>>(initial.slaHours);
  const [dupThreshold, setDupThreshold] = useState(Math.round(initial.duplicates.threshold * 100));
  const [dupWindow, setDupWindow] = useState(initial.duplicates.windowDays);
  const [error, setError] = useState<string>();

  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        routing: {
          autoRouteConfidence: confidence / 100,
          reviewCriticalPriority: reviewCritical,
          reviewCategories,
        },
        slaHours: sla,
        duplicates: { threshold: dupThreshold / 100, windowDays: dupWindow },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(confidence >= 50 && confidence <= 100))
      return setError('Confidence threshold must be between 50 and 100%.');
    if (PRIORITIES.some((p) => !(Number.isInteger(sla[p]) && sla[p] >= 1)))
      return setError('Resolution times must be whole hours (at least 1).');
    if (!(dupThreshold >= 30 && dupThreshold <= 95))
      return setError('Duplicate match threshold must be between 30 and 95%.');
    if (!(Number.isInteger(dupWindow) && dupWindow >= 1 && dupWindow <= 180))
      return setError('Duplicate window must be 1–180 days.');
    setError(undefined);
    save.mutate();
  };

  const inputCls =
    'w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-2 focus:outline-brand-500';

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-2">
      <Card title="Automatic routing rules">
        <div className="space-y-5 text-sm">
          <div>
            <label htmlFor="confidence" className="block font-medium text-slate-800">
              Minimum AI confidence for automatic routing
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="confidence"
                type="number"
                min={50}
                max={100}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className={inputCls}
                aria-describedby="confidence-hint"
              />
              <span>%</span>
            </div>
            <p id="confidence-hint" className="mt-1 text-xs text-slate-500">
              Below this, complaints go to the review queue. Range 50–100%.
            </p>
          </div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-600"
              checked={reviewCritical}
              onChange={(e) => setReviewCritical(e.target.checked)}
            />
            <span>
              <span className="font-medium text-slate-800">
                Always have a person confirm Critical complaints
              </span>
              <span className="block text-xs text-slate-500">
                Recommended: safety issues should be checked by a human before routing.
              </span>
            </span>
          </label>
          <fieldset>
            <legend className="font-medium text-slate-800">
              Categories that always need admin review
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={reviewCategories.includes(c)}
                    onChange={(e) =>
                      setReviewCategories(
                        e.target.checked
                          ? [...reviewCategories, c]
                          : reviewCategories.filter((x) => x !== c),
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>
      <Card title="Target resolution time (hours)">
        <div className="space-y-3 text-sm">
          {PRIORITIES.map((p) => (
            <div key={p} className="flex items-center justify-between gap-4">
              <label htmlFor={`sla-${p}`} className="font-medium text-slate-800">
                {p}
              </label>
              <input
                id={`sla-${p}`}
                type="number"
                min={1}
                value={sla[p]}
                onChange={(e) => setSla({ ...sla, [p]: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Tickets open longer than this are shown as overdue. Applies to newly classified tickets.
          </p>
        </div>
      </Card>
      <Card title="Duplicate detection" className="lg:col-span-2">
        <div className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <label htmlFor="dup-threshold" className="block font-medium text-slate-800">
              Minimum match to suggest a duplicate
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="dup-threshold"
                type="number"
                min={30}
                max={95}
                value={dupThreshold}
                onChange={(e) => setDupThreshold(Number(e.target.value))}
                className={inputCls}
              />
              <span>%</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Lower = more suggestions (more false alarms). Range 30–95%.
            </p>
          </div>
          <div>
            <label htmlFor="dup-window" className="block font-medium text-slate-800">
              Compare with open complaints from the last
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="dup-window"
                type="number"
                min={1}
                max={180}
                value={dupWindow}
                onChange={(e) => setDupWindow(Number(e.target.value))}
                className={inputCls}
              />
              <span>days</span>
            </div>
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-3 lg:col-span-2">
        {error && <Alert tone="error">{error}</Alert>}
        {save.isSuccess && !error && <Alert tone="success">Settings saved.</Alert>}
        <Button type="submit" loading={save.isPending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

function DepartmentRow({ department }: { department: DepartmentDTO }) {
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Category[]>(department.categories);
  const changed = [...categories].sort().join() !== [...department.categories].sort().join();
  const save = useMutation({
    mutationFn: () => updateDepartmentCategories(department.id, categories),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <p className="w-52 shrink-0 font-medium text-slate-900">{department.name}</p>
      <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
        {CATEGORIES.map((c) => (
          <label key={c} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={categories.includes(c)}
              onChange={(e) =>
                setCategories(
                  e.target.checked ? [...categories, c] : categories.filter((x) => x !== c),
                )
              }
            />
            {c}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {save.isError && (
          <span role="alert" className="text-sm text-red-700">
            {save.error.message}
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={!changed}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function UnmappedWarning({ departments }: { departments: DepartmentDTO[] }) {
  const mapped = new Set(departments.flatMap((d) => d.categories));
  const missing = CATEGORIES.filter((c) => !mapped.has(c));
  if (missing.length === 0) return null;
  return (
    <div className="mt-4">
      <Alert tone="warning">
        Not mapped to any department: <strong>{missing.join(', ')}</strong>. Complaints in these
        categories will always wait for an administrator.
      </Alert>
    </div>
  );
}
