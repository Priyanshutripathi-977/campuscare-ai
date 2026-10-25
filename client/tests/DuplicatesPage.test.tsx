import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DuplicateSuggestionDTO, UserDTO } from '@campuscare/shared';
import { DuplicatesPage } from '../src/pages/admin/DuplicatesPage';
import { jsonResponse, mockApi, renderWithProviders } from './renderWithProviders';
import { ticketFixture } from './fixtures';

const admin: UserDTO = {
  id: 'a',
  name: 'Admin',
  email: 'a@x.test',
  role: 'admin',
  department: null,
};
const suggestion: DuplicateSuggestionDTO = {
  id: 's1',
  score: 0.71,
  reasons: ['Description 46% similar', 'Same room (101)'],
  status: 'pending',
  ticket: ticketFixture({ ticketId: 'CC-2026-000002', title: 'Ceiling fan broken - 101' }),
  candidate: ticketFixture({ ticketId: 'CC-2026-000001', title: 'Fan not working in room 101' }),
  createdAt: new Date().toISOString(),
  reviewedAt: null,
  reviewedBy: null,
  note: null,
};
const page = (items: DuplicateSuggestionDTO[]) =>
  jsonResponse({ items, total: items.length, page: 1, pages: 1 });

describe('DuplicatesPage', () => {
  it('shows both tickets, the match score and the reasons', async () => {
    mockApi([['/api/admin/duplicates', () => page([suggestion])]]);
    renderWithProviders(<DuplicatesPage />, { user: admin });
    expect(await screen.findByText('71% match')).toBeInTheDocument();
    expect(screen.getByText('Ceiling fan broken - 101')).toBeInTheDocument();
    expect(screen.getByText('Fan not working in room 101')).toBeInTheDocument();
    expect(screen.getByText('Same room (101)')).toBeInTheDocument();
  });

  it('confirming asks first, then sends the decision with the note', async () => {
    const spy = mockApi([
      [
        '/api/admin/duplicates/s1',
        () => jsonResponse({ suggestion: { id: 's1', status: 'confirmed' } }),
      ],
      ['/api/admin/duplicates', () => page([suggestion])],
    ]);
    renderWithProviders(<DuplicatesPage />, { user: admin });
    await userEvent.click(await screen.findByRole('button', { name: /confirm duplicate/i }));
    const dialog = screen.getByRole('dialog', { name: /confirm duplicate/i });
    expect(within(dialog).getByText(/both tickets stay open/i)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/note to the student/i), 'Same fan');
    await userEvent.click(within(dialog).getByRole('button', { name: /link as duplicate/i }));

    const call = spy.mock.calls.find(
      ([url, init]) => String(url).endsWith('/s1') && init?.method === 'PATCH',
    );
    expect(JSON.parse(String(call![1]!.body))).toEqual({ decision: 'confirmed', note: 'Same fan' });
  });

  it('dismisses with one click', async () => {
    const spy = mockApi([
      [
        '/api/admin/duplicates/s1',
        () => jsonResponse({ suggestion: { id: 's1', status: 'dismissed' } }),
      ],
      ['/api/admin/duplicates', () => page([suggestion])],
    ]);
    renderWithProviders(<DuplicatesPage />, { user: admin });
    await userEvent.click(await screen.findByRole('button', { name: /not a duplicate/i }));
    const call = spy.mock.calls.find(([url]) => String(url).endsWith('/s1'));
    expect(JSON.parse(String(call![1]!.body))).toEqual({ decision: 'dismissed' });
  });

  it('shows an empty state when there is nothing to review', async () => {
    mockApi([['/api/admin/duplicates', () => page([])]]);
    renderWithProviders(<DuplicatesPage />, { user: admin });
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
  });
});
