import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { MyTicketsPage } from '../src/pages/student/MyTicketsPage';
import { jsonResponse, mockApi, renderWithProviders, studentUser } from './renderWithProviders';
import { ticketFixture } from './fixtures';

describe('MyTicketsPage', () => {
  it('shows a helpful empty state with a call to action', async () => {
    mockApi([['/api/tickets', () => jsonResponse({ items: [], total: 0, page: 1, pages: 1 })]]);
    renderWithProviders(<MyTicketsPage />, { user: studentUser });
    expect(await screen.findByText(/haven't reported anything yet/i)).toBeInTheDocument();
  });

  it('lists tickets with their ID and status', async () => {
    mockApi([
      [
        '/api/tickets',
        () =>
          jsonResponse({ items: [ticketFixture({ isDemo: true })], total: 1, page: 1, pages: 1 }),
      ],
    ]);
    renderWithProviders(<MyTicketsPage />, { user: studentUser });
    expect(await screen.findByText('CC-2026-000001')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(within(list).getByText('In Progress')).toBeInTheDocument();
    expect(within(list).getByText(/demo data/i)).toBeInTheDocument();
  });

  it('passes URL filters to the API', async () => {
    const spy = mockApi([
      ['/api/tickets', () => jsonResponse({ items: [], total: 0, page: 1, pages: 1 })],
    ]);
    renderWithProviders(<MyTicketsPage />, { user: studentUser, route: '/?status=Resolved&q=fan' });
    expect(await screen.findByText(/no complaints match/i)).toBeInTheDocument();
    expect(String(spy.mock.calls[0]![0])).toMatch(/status=Resolved/);
    expect(String(spy.mock.calls[0]![0])).toMatch(/q=fan/);
  });

  it('shows an error with retry when loading fails', async () => {
    mockApi([
      ['/api/tickets', () => jsonResponse({ error: { message: 'Database unavailable' } }, 500)],
    ]);
    renderWithProviders(<MyTicketsPage />, { user: studentUser });
    expect(await screen.findByRole('alert')).toHaveTextContent(/database unavailable/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
