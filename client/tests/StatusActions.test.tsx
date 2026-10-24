import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusActions } from '../src/components/tickets/StatusActions';
import { jsonResponse, mockApi, renderWithProviders, staffUser } from './renderWithProviders';
import { ticketFixture } from './fixtures';

describe('StatusActions (resolve confirmation)', () => {
  it('only offers transitions allowed for the role', () => {
    mockApi([]);
    renderWithProviders(
      <StatusActions ticket={ticketFixture({ status: 'Assigned' })} role="staff" />,
      { user: staffUser },
    );
    expect(screen.getByRole('button', { name: /start work/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resolved/i })).not.toBeInTheDocument();
  });

  it('requires a note AND explicit confirmation before resolving', async () => {
    const fetchSpy = mockApi([
      ['/status', () => jsonResponse({ ticket: ticketFixture({ status: 'Resolved' }) })],
    ]);
    renderWithProviders(
      <StatusActions ticket={ticketFixture({ status: 'In Progress' })} role="staff" />,
      { user: staffUser },
    );

    await userEvent.click(screen.getByRole('button', { name: /mark as resolved/i }));
    const dialog = screen.getByRole('dialog', { name: /confirm resolution/i });
    await userEvent.click(within(dialog).getByRole('button', { name: /confirm & resolve/i }));

    expect(within(dialog).getByText(/describe how the problem was resolved/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/please confirm/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    await userEvent.type(
      within(dialog).getByLabelText(/resolution note/i),
      'Replaced the fan capacitor',
    );
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirm & resolve/i }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      status: 'Resolved',
      note: 'Replaced the fan capacitor',
      confirm: true,
    });
  });

  it('closes the dialog with Escape without sending anything', async () => {
    const fetchSpy = mockApi([]);
    renderWithProviders(
      <StatusActions ticket={ticketFixture({ status: 'In Progress' })} role="staff" />,
      { user: staffUser },
    );
    await userEvent.click(screen.getByRole('button', { name: /mark as resolved/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
