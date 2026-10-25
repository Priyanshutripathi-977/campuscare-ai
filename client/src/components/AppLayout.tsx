/** Page frame: top bar with role-based navigation, the user's name and a logout button. */
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import type { Role } from '@campuscare/shared';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { PageLoader } from './ui/States';

const NAV: Record<Role, { to: string; label: string; end?: boolean }[]> = {
  student: [
    { to: '/student', label: 'My complaints', end: true },
    { to: '/student/new', label: 'Report a problem' },
  ],
  staff: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/tickets', label: 'Department tickets' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/tickets', label: 'All tickets' },
    { to: '/admin/duplicates', label: 'Duplicates' },
    { to: '/admin/settings', label: 'Settings' },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!user) return null;

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            CampusCare AI
          </Link>
          <nav
            aria-label="Main"
            className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto"
          >
            {NAV[user.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-sm leading-tight sm:block">
              <p className="font-medium text-slate-900">{user.name}</p>
              <p className="text-xs capitalize text-slate-500">
                {user.role}
                {user.department && ` · ${user.department.name}`}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={onLogout} loading={loggingOut}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* Shows a spinner while a lazily-loaded page (e.g. the dashboard) downloads. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
