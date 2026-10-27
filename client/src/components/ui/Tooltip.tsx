/**
 * Small text hint shown on hover AND keyboard focus. The trigger gets aria-describedby,
 * so screen readers read the hint too.
 */
import { cloneElement, useId, type ReactElement } from 'react';

export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: 'top' | 'bottom';
}) {
  const id = useId();
  return (
    <span className="group/tt relative inline-flex">
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 ${side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
      >
        {label}
      </span>
    </span>
  );
}
