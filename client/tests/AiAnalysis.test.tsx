import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AiAnalysisDTO, UserDTO } from '@campuscare/shared';
import { AiAnalysisCard } from '../src/components/tickets/AiAnalysisCard';
import { TicketDetailPage } from '../src/pages/TicketDetailPage';
import {
  jsonResponse,
  mockApi,
  renderWithProviders,
  staffUser,
  studentUser,
} from './renderWithProviders';
import { ticketFixture } from './fixtures';

const adminUser: UserDTO = {
  id: 'a1',
  name: 'Admin',
  email: 'a@x.test',
  role: 'admin',
  department: null,
};

const analysis = (o: Partial<AiAnalysisDTO> = {}): AiAnalysisDTO => ({
  view: 'full',
  source: 'gemini',
  model: 'gemini-2.5-flash',
  valid: true,
  error: null,
  category: 'Electrical',
  priority: 'Critical',
  confidence: 0.91,
  summary: 'Socket sparking in Lab 3.',
  extractedLocation: { building: 'Block B', room: 'Lab 3' },
  keyDetails: ['Burning smell'],
  categoryReason: 'Sockets are electrical.',
  priorityReason: 'Sparks can start a fire.',
  needsClarification: false,
  clarificationQuestion: null,
  safetyRisk: true,
  recommendedDepartment: { id: 'd1', name: 'Electrical Maintenance' },
  processedAt: new Date().toISOString(),
  ...o,
});

describe('AiAnalysisCard', () => {
  it('explains the suggestion, confidence and reasons', () => {
    mockApi([]);
    renderWithProviders(
      <AiAnalysisCard ticket={ticketFixture({ ai: analysis() })} canRerun={false} />,
      { user: staffUser },
    );
    expect(screen.getByText(/Gemini · gemini-2.5-flash/)).toBeInTheDocument();
    expect(screen.getByText('91% confident')).toBeInTheDocument();
    expect(screen.getByText('Safety risk')).toBeInTheDocument();
    expect(screen.getByText(/Electrical · Critical → Electrical Maintenance/)).toBeInTheDocument();
    expect(screen.getByText('Sparks can start a fire.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-run/i })).not.toBeInTheDocument();
  });

  it('is honest when the fallback was used because Gemini failed', () => {
    mockApi([]);
    renderWithProviders(
      <AiAnalysisCard
        ticket={ticketFixture({
          ai: analysis({ source: 'fallback_rules', model: null, valid: false, error: 'timeout' }),
        })}
        canRerun={false}
      />,
      { user: staffUser },
    );
    expect(screen.getByText('Keyword fallback')).toBeInTheDocument();
    expect(screen.getByText(/Gemini did not answer in time/)).toBeInTheDocument();
  });

  it('lets an admin re-run analysis for a ticket under review', async () => {
    const spy = mockApi([
      [
        '/reanalyze',
        () => jsonResponse({ ticket: ticketFixture({ status: 'Assigned', ai: analysis() }) }),
      ],
    ]);
    renderWithProviders(
      <AiAnalysisCard
        ticket={ticketFixture({ status: 'Under Review', ai: analysis() })}
        canRerun
      />,
      { user: adminUser },
    );
    await userEvent.click(screen.getByRole('button', { name: /re-run ai analysis/i }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![1]?.method).toBe('POST');
  });
});

describe('TicketDetailPage clarification request', () => {
  it('shows the AI question to the student', async () => {
    mockApi([
      [
        '/api/tickets/CC-2026-000001',
        () =>
          jsonResponse({
            ticket: ticketFixture({
              status: 'Under Review',
              ai: {
                view: 'student',
                source: 'fallback_rules',
                summary: 'Something is broken.',
                category: 'Other',
                priority: 'Medium',
                recommendedDepartment: null,
                needsClarification: true,
                clarificationQuestion: 'Which room is it in?',
              },
            }),
          }),
      ],
    ]);
    renderWithProviders(<TicketDetailPage />, {
      user: studentUser,
      route: '/tickets/CC-2026-000001',
      path: '/tickets/:ticketId',
    });
    expect(await screen.findByText('We need a few more details')).toBeInTheDocument();
    expect(screen.getByText('Which room is it in?')).toBeInTheDocument();
    expect(screen.queryByText('AI analysis')).not.toBeInTheDocument(); // students don't see internals
  });
});
