/** Page frame: sidebar (drawer on phones) + top bar + the current page. */
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui/States';
import { Sidebar } from './layout/Sidebar';
import { Topbar } from './layout/Topbar';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer with Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  if (!user) return null;

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen lg:pl-64">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar user={user} />
      </aside>

      {/* Phone/tablet drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0 bg-navy-950/50 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-up shadow-pop">
            <Sidebar user={user} onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              autoFocus
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <Topbar user={user} onMenu={() => setDrawerOpen(true)} onLogout={onLogout} />

      <main
        id="main"
        key={location.pathname}
        className="mx-auto max-w-7xl px-4 py-6 animate-fade-in sm:px-6 sm:py-8"
      >
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
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-navy-900 sm:text-[28px]">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
