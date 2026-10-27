import {
  Bell,
  Copy,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ScanSearch,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@campuscare/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Which live counter (from /api/admin/stats) to show as a badge. */
  badge?: 'needsReview' | 'pendingDuplicates';
}

/** The sidebar menu for each role. Every entry is a real page. */
export const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/tickets', label: 'My complaints', icon: ListChecks },
    { to: '/student/new', label: 'Report a problem', icon: FilePlus2 },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  staff: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/tickets', label: 'Department tickets', icon: Inbox },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/tickets', label: 'All tickets', icon: Inbox },
    {
      to: '/admin/tickets?needsReview=true',
      label: 'Review queue',
      icon: ScanSearch,
      badge: 'needsReview',
    },
    { to: '/admin/duplicates', label: 'Duplicates', icon: Copy, badge: 'pendingDuplicates' },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
};

/** Exact match on path; "?needsReview=true" only matches the review queue, not "All tickets". */
export function isNavActive(item: NavItem, pathname: string, search: string) {
  const [path, query] = item.to.split('?');
  const params = new URLSearchParams(search);
  if (query) return pathname === path && params.get('needsReview') === 'true';
  if (path === '/admin/tickets') return pathname === path && params.get('needsReview') !== 'true';
  return pathname === path;
}
