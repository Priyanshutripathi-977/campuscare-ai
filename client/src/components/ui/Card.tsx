import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Card({
  children,
  className = '',
  title,
  description,
  icon: Icon,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {Icon && (
              <span
                aria-hidden
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div>
              {title && <h2 className="text-base font-semibold text-navy-900">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
