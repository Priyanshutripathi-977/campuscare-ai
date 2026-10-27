/**
 * Accessible form fields: every input has a visible <label>, and hints/errors are
 * connected with aria-describedby so screen readers announce them.
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

function FieldShell({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-navy-800">
        {label}
        {required ? (
          <span className="text-red-600" aria-hidden>
            {' '}
            *
          </span>
        ) : (
          <span className="font-normal text-slate-500"> (optional)</span>
        )}
      </label>
      <div className="mt-1">{children({ id, describedBy, invalid: Boolean(error) })}</div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  'block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-xs transition-colors placeholder:text-slate-500 hover:border-slate-400 ' +
  'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/25 disabled:bg-slate-100';
const controlState = (invalid: boolean) => (invalid ? 'border-red-500' : 'border-slate-300');

type Common = { label: string; error?: string; hint?: ReactNode };

export function TextField({
  label,
  error,
  hint,
  required,
  className = '',
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={`${control} ${controlState(invalid)} ${className}`}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({
  label,
  error,
  hint,
  required,
  className = '',
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={`${control} ${controlState(invalid)} ${className}`}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className = '',
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={`${control} ${controlState(invalid)} ${className}`}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
