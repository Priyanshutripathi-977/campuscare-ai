/** Left navigation: role-based links, active-page indicator and live counters. */
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { UserDTO } from '@campuscare/shared';
import { getStats } from '../../api/admin';
import { isNavActive, NAV } from './navigation';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg shadow-sm" />
      <span
        className={`text-[15px] font-semibold tracking-tight ${light ? 'text-white' : 'text-navy-900'}`}
      >
        CampusCare <span className={light ? 'text-brand-300' : 'text-brand-600'}>AI</span>
      </span>
    </span>
  );
}

export function Sidebar({ user, onNavigate }: { user: UserDTO; onNavigate?: () => void }) {
  const { pathname, search } = useLocation();
  // Live counters for admins/staff — the same real numbers as the dashboard (shared cache).
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    enabled: user.role !== 'student',
    staleTime: 30_000,
  });

  return (
    <div className="flex h-full flex-col bg-navy-900 text-slate-300">
      <div className="flex h-16 items-center px-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-brand-400"
        >
          <Logo light />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV[user.role].map((item) => {
          const active = isNavActive(item, pathname, search);
          const count = item.badge ? stats.data?.[item.badge] : undefined;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-400 ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-400"
                />
              )}
              <Icon
                aria-hidden
                className={`h-[18px] w-[18px] ${active ? 'text-brand-300' : 'text-slate-400 group-hover:text-slate-200'}`}
              />
              <span className="flex-1">{item.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {count}
                  <span className="sr-only"> waiting</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
        <p className="font-medium text-slate-200">{user.name}</p>
        <p className="capitalize">
          {user.role}
          {user.department && ` · ${user.department.name}`}
        </p>
      </div>
    </div>
  );
}
