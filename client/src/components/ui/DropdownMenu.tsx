/**
 * Accessible dropdown menu: opens with click/Enter/Space/ArrowDown, arrow keys move between
 * items, Escape or a click outside closes it and returns focus to the trigger.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}

export function DropdownMenu({
  trigger,
  triggerLabel,
  items,
  header,
  align = 'right',
}: {
  trigger: ReactNode;
  triggerLabel: string;
  items: MenuItem[];
  header?: ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const focusItem = (index: number) => {
    const els = wrapper.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!els?.length) return;
    els[(index + els.length) % els.length]!.focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(0); // the menu is already in the DOM when this effect runs
    const onClick = (e: MouseEvent) =>
      !wrapper.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = [
      ...(wrapper.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
    ];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(i + 1);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(i - 1);
    }
    if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    }
    if (e.key === 'End') {
      e.preventDefault();
      focusItem(els.length - 1);
    }
    if (e.key === 'Escape' || e.key === 'Tab') close();
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'ArrowDown' && (e.preventDefault(), setOpen(true))}
        className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        {/* The accessible name = hidden prefix + the visible trigger text, so what people see is
            part of the name (needed for voice control, WCAG 2.5.3). */}
        <span className="sr-only">{triggerLabel}:</span> {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onMenuKey}
          className={`absolute z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop animate-scale-in ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
        >
          {header && <div className="border-b border-slate-100 px-4 py-3">{header}</div>}
          {items.map(({ label, icon: Icon, onSelect, tone }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm outline-none transition-colors focus:bg-slate-100 hover:bg-slate-50 ${tone === 'danger' ? 'text-red-700' : 'text-navy-800'}`}
            >
              {Icon && <Icon aria-hidden className="h-4 w-4 opacity-70" />}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
