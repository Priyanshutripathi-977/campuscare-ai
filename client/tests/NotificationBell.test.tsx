import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NotificationDTO } from '@campuscare/shared';
import { NotificationBell } from '../src/components/notifications/NotificationBell';
import { jsonResponse, mockApi, renderWithProviders, studentUser } from './renderWithProviders';

const n = (o: Partial<NotificationDTO> = {}): NotificationDTO => ({
  id: 'n1',
  type: 'status_changed',
  message: 'Work has started on your complaint.',
  read: false,
  createdAt: new Date().toISOString(),
  ticket: { ticketId: 'CC-2026-000001', title: 'Fan' },
  email: { status: 'not_configured', error: null, sentAt: null },
  ...o,
});
const list = (items: NotificationDTO[]) =>
  jsonResponse({
    items,
    total: items.length,
    page: 1,
    pages: 1,
    unreadCount: items.filter((i) => !i.read).length,
  });

describe('NotificationBell', () => {
  it('shows the unread count in an accessible label', async () => {
    mockApi([
      ['/api/notifications', () => list([n(), n({ id: 'n2' }), n({ id: 'n3', read: true })])],
    ]);
    renderWithProviders(<NotificationBell />, { user: studentUser });
    expect(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' }),
    ).toBeInTheDocument();
  });

  it('opens a panel with messages and honest email status', async () => {
    mockApi([
      [
        '/api/notifications',
        () =>
          list([
            n({ email: { status: 'sent', error: null, sentAt: new Date().toISOString() } }),
            n({
              id: 'n2',
              message: 'Your complaint was marked as resolved',
              email: { status: 'failed', error: 'ECONNREFUSED', sentAt: null },
            }),
            n({ id: 'n3', message: 'Another update' }),
          ]),
      ],
    ]);
    renderWithProviders(<NotificationBell />, { user: studentUser });
    await userEvent.click(await screen.findByRole('button', { name: /notifications, 3 unread/i }));
    const panel = screen.getByRole('region', { name: 'Notifications' });
    expect(within(panel).getByText('Work has started on your complaint.')).toBeInTheDocument();
    expect(within(panel).getByText('✓ Email sent')).toBeInTheDocument();
    expect(within(panel).getByText('✕ Email failed')).toHaveAttribute('title', 'ECONNREFUSED');
    expect(within(panel).getByText('In-app only')).toBeInTheDocument();
  });

  it('clicking a notification marks it read', async () => {
    const spy = mockApi([
      ['/api/notifications/n1/read', () => jsonResponse({ id: 'n1', read: true })],
      ['/api/notifications', () => list([n()])],
    ]);
    renderWithProviders(<NotificationBell />, { user: studentUser });
    await userEvent.click(await screen.findByRole('button', { name: /1 unread/i }));
    await userEvent.click(screen.getByRole('button', { name: /work has started/i }));
    expect(
      spy.mock.calls.some(
        ([url, init]) => String(url).endsWith('/n1/read') && init?.method === 'PATCH',
      ),
    ).toBe(true);
  });

  it('"Mark all as read" calls the API; Escape closes the panel', async () => {
    const spy = mockApi([
      ['/api/notifications/read-all', () => jsonResponse({ updated: 1 })],
      ['/api/notifications', () => list([n()])],
    ]);
    renderWithProviders(<NotificationBell />, { user: studentUser });
    await userEvent.click(await screen.findByRole('button', { name: /1 unread/i }));
    await userEvent.click(screen.getByRole('button', { name: /mark all as read/i }));
    expect(spy.mock.calls.some(([url]) => String(url).endsWith('/read-all'))).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockApi([['/api/notifications', () => list([])]]);
    renderWithProviders(<NotificationBell />, { user: studentUser });
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });
});
