import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewComplaintPage } from '../src/pages/student/NewComplaintPage';
import { jsonResponse, mockApi, renderWithProviders, studentUser } from './renderWithProviders';
import { ticketFixture } from './fixtures';

const setup = () => renderWithProviders(<NewComplaintPage />, { user: studentUser });

describe('NewComplaintPage', () => {
  it('shows field errors and sends nothing when the form is empty', async () => {
    const fetchSpy = mockApi([]);
    setup();
    await userEvent.click(screen.getByRole('button', { name: /submit complaint/i }));

    expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 20 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/enter the building or area/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/short title/i)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects non-image files before uploading', async () => {
    mockApi([]);
    setup();
    const file = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText(/photo/i), file, { applyAccept: false });
    expect(screen.getByText(/must be a JPG, PNG or WebP/i)).toBeInTheDocument();
  });

  it('submits a valid complaint and shows the new ticket ID', async () => {
    const fetchSpy = mockApi([
      [
        '/api/tickets',
        () =>
          jsonResponse(
            { ticket: ticketFixture({ ticketId: 'CC-2026-000042', status: 'Under Review' }) },
            201,
          ),
      ],
    ]);
    setup();
    await userEvent.type(screen.getByLabelText(/short title/i), 'Fan not working');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'The ceiling fan in room 101 is not working at all.',
    );
    await userEvent.type(screen.getByLabelText(/building/i), 'Main Building');
    await userEvent.click(screen.getByRole('button', { name: /submit complaint/i }));

    expect(await screen.findByText('CC-2026-000042')).toBeInTheDocument();
    const [, init] = fetchSpy.mock.calls[0]!;
    const sent = JSON.parse(String((init!.body as FormData).get('data')));
    expect(sent).toMatchObject({
      title: 'Fan not working',
      location: { building: 'Main Building' },
    });
    expect(sent.category).toBeUndefined(); // "Not sure" → let the system decide
  });

  it('shows server-side errors next to the right field', async () => {
    mockApi([
      [
        '/api/tickets',
        () =>
          jsonResponse(
            {
              error: {
                message: 'Some fields are invalid',
                details: { fieldErrors: { image: 'Image must be a JPG, PNG or WebP file' } },
              },
            },
            400,
          ),
      ],
    ]);
    setup();
    await userEvent.type(screen.getByLabelText(/short title/i), 'Fan not working');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'The ceiling fan in room 101 is not working at all.',
    );
    await userEvent.type(screen.getByLabelText(/building/i), 'Main Building');
    await userEvent.click(screen.getByRole('button', { name: /submit complaint/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/some fields are invalid/i);
    expect(screen.getByText(/must be a JPG, PNG or WebP/i)).toBeInTheDocument();
  });
});
