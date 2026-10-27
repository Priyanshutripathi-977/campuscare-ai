/** Standard loading / error / empty states so every page behaves the same way. */
import type { ReactNode } from 'react';
import { AlertOctagon, FileSearch, type LucideIcon } from 'lucide-react';
import { Spinner } from './Spinner';
import { Button } from './Button';

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex justify-center py-16">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  error,
  onRetry,
}: {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}) {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center animate-fade-in"
    >
      <span
        aria-hidden
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600"
      >
        <AlertOctagon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-semibold text-red-900">{title}</p>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = FileSearch,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center animate-fade-in">
      <span
        aria-hidden
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"
      >
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 font-semibold text-navy-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
