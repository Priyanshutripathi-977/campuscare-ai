/**
 * Search + filter bar. Filters live in the URL (?status=…&q=…) so a filtered
 * view can be bookmarked, shared, or restored with the browser's back button.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  TICKET_SORTS,
  type DepartmentDTO,
} from '@campuscare/shared';
import { Button } from '../ui/Button';

const SORT_LABELS: Record<(typeof TICKET_SORTS)[number], string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  priority: 'Highest priority',
  due: 'Due soonest',
};

const selectCls =
  'h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-800 transition-colors hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/25';

interface Props {
  showAdminFilters?: boolean;
  departments?: DepartmentDTO[];
}

export function TicketFilters({ showAdminFilters = false, departments = [] }: Props) {
  const [params, setParams] = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // any filter change goes back to page 1
    setParams(next);
  };

  const active = [...params.keys()].some((k) => k !== 'page' && k !== 'sort');

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
      {/* key= resets the box when the URL's search changes (e.g. browser back button). */}
      <SearchBox
        key={params.get('q') ?? ''}
        initial={params.get('q') ?? ''}
        onSearch={(q) => update('q', q)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Status"
          allLabel="All statuses"
          value={params.get('status') ?? ''}
          onChange={(v) => update('status', v)}
          options={STATUSES}
        />
        <FilterSelect
          label="Category"
          allLabel="All categories"
          value={params.get('category') ?? ''}
          onChange={(v) => update('category', v)}
          options={CATEGORIES}
        />
        <FilterSelect
          label="Priority"
          allLabel="All priorities"
          value={params.get('priority') ?? ''}
          onChange={(v) => update('priority', v)}
          options={PRIORITIES}
        />
        {showAdminFilters && departments.length > 0 && (
          <label className="text-sm">
            <span className="sr-only">Department</span>
            <select
              className={selectCls}
              value={params.get('department') ?? ''}
              onChange={(e) => update('department', e.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {showAdminFilters && (
          <>
            <Toggle
              label="Overdue only"
              checked={params.get('overdue') === 'true'}
              onChange={(on) => update('overdue', on ? 'true' : '')}
            />
            <Toggle
              label="Needs review"
              checked={params.get('needsReview') === 'true'}
              onChange={(on) => update('needsReview', on ? 'true' : '')}
            />
          </>
        )}
        <label className="ml-auto text-sm">
          <span className="sr-only">Sort</span>
          <select
            className={selectCls}
            value={params.get('sort') ?? 'newest'}
            onChange={(e) => update('sort', e.target.value === 'newest' ? '' : e.target.value)}
          >
            {TICKET_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {active && (
          <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams())}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

function SearchBox({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [search, setSearch] = useState(initial);
  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(search.trim());
      }}
    >
      <label htmlFor="ticket-search" className="sr-only">
        Search tickets
      </label>
      <input
        id="ticket-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={100}
        placeholder="Search by title, ticket ID or building…"
        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-navy-900 placeholder:text-slate-500 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/25"
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}

function FilterSelect({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  allLabel: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="text-sm">
      <span className="sr-only">{label}</span>
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-navy-800 transition-colors hover:border-slate-300 has-checked:border-brand-500 has-checked:bg-brand-50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/25">
      <input
        type="checkbox"
        className="accent-brand-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** Reads the current filters from the URL in the shape the API expects. */
export function useTicketQueryFromUrl(defaultLimit = 10) {
  const [params] = useSearchParams();
  const get = (k: string) => params.get(k) ?? undefined;
  return {
    q: get('q'),
    status: get('status'),
    category: get('category'),
    priority: get('priority'),
    department: get('department'),
    overdue: get('overdue'),
    needsReview: get('needsReview'),
    sort: get('sort'),
    page: Number(params.get('page') ?? 1) || 1,
    limit: defaultLimit,
  };
}
