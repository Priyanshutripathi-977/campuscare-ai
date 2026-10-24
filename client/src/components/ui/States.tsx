/** Standard loading / error / empty states so every page behaves the same way. */
import type { ReactNode } from 'react';
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
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-semibold text-red-800">{title}</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="mx-auto h-10 w-10 text-slate-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M9 12h6m-6 4h6M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      </svg>
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
