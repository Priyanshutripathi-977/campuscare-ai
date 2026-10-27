/** Top bar: menu button (phones), ticket search, notifications and the profile menu. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, LayoutDashboard, LogOut, Menu, Search } from 'lucide-react';
import type { UserDTO } from '@campuscare/shared';
import { homePathFor } from '../../context/AuthContext';
import { DropdownMenu } from '../ui/DropdownMenu';
import { NotificationBell } from '../notifications/NotificationBell';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function Topbar({
  user,
  onMenu,
  onLogout,
}: {
  user: UserDTO;
  onMenu: () => void;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const listPath = user.role === 'student' ? '/student/tickets' : '/admin/tickets';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>

        <form
          role="search"
          className="relative max-w-md flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const term = q.trim();
            navigate(term ? `${listPath}?q=${encodeURIComponent(term)}` : listPath);
            setQ('');
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Search tickets
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          />
          <input
            id="global-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="Search tickets by ID, title or building…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-navy-900 placeholder:text-slate-500 transition-colors hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/25"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <NotificationBell />
          <DropdownMenu
            triggerLabel="Account menu"
            trigger={
              <>
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white"
                >
                  {initials(user.name)}
                </span>
                <span className="sr-only md:not-sr-only md:block md:text-left md:leading-tight">
                  <span className="block text-sm font-medium text-navy-900">{user.name}</span>{' '}
                  <span className="block text-xs capitalize text-slate-600">({user.role})</span>
                </span>
              </>
            }
            header={
              <div className="text-sm">
                <p className="font-medium text-navy-900">{user.name}</p>
                <p className="truncate text-slate-600">{user.email}</p>
                <p className="mt-1 text-xs capitalize text-slate-600">
                  {user.role}
                  {user.department && ` · ${user.department.name}`}
                </p>
              </div>
            }
            items={[
              {
                label: 'My dashboard',
                icon: LayoutDashboard,
                onSelect: () => navigate(homePathFor(user)),
              },
              { label: 'Notifications', icon: Bell, onSelect: () => navigate('/notifications') },
              { label: 'Log out', icon: LogOut, tone: 'danger', onSelect: onLogout },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
