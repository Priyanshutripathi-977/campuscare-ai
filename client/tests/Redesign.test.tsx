/** Tests for the components added in the UI redesign. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AiAnalysisDTO, StatsDTO, UserDTO } from '@campuscare/shared';
import { Dropzone } from '../src/components/ui/Dropzone';
import { TicketProgress } from '../src/components/tickets/TicketProgress';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Topbar } from '../src/components/layout/Topbar';
import { AdminRoutingPanel } from '../src/components/tickets/AdminRoutingPanel';
import { jsonResponse, mockApi, renderWithProviders, studentUser } from './renderWithProviders';
import { ticketFixture } from './fixtures';

const admin: UserDTO = {
  id: 'a',
  name: 'Demo Admin',
  email: 'admin@x.test',
  role: 'admin',
  department: null,
};

describe('Dropzone', () => {
  const setup = () => {
    const onFile = vi.fn();
    const onError = vi.fn();
    render(<Dropzone file={null} previewUrl={null} onFile={onFile} onError={onError} maxMb={5} />);
    return { onFile, onError, zone: screen.getByLabelText(/photo/i).parentElement! };
  };

  it('accepts a dropped image', () => {
    const { onFile, onError, zone } = setup();
    const img = new File(['x'], 'fan.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { files: [img] } });
    expect(onFile).toHaveBeenCalledWith(img);
    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it('rejects a dropped PDF and a too-large image with clear messages', () => {
    const { onFile, onError, zone } = setup();
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] },
    });
    expect(onError).toHaveBeenLastCalledWith('Image must be a JPG, PNG or WebP file');
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    fireEvent.drop(zone, { dataTransfer: { files: [big] } });
    expect(onError).toHaveBeenLastCalledWith('Image is too large (max 5 MB)');
    expect(onFile).toHaveBeenLastCalledWith(null);
  });

  it('shows a preview with a working remove button', async () => {
    const onFile = vi.fn();
    render(
      <Dropzone
        file={new File(['x'], 'fan.png', { type: 'image/png' })}
        previewUrl="data:image/png;base64,AA=="
        onFile={onFile}
        onError={() => {}}
        maxMb={5}
      />,
    );
    expect(screen.getByAltText('Selected photo preview')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove photo/i }));
    expect(onFile).toHaveBeenCalledWith(null);
  });
});

describe('TicketProgress', () => {
  it('marks finished steps as done and the current one as current, with real dates', () => {
    render(
      <TicketProgress
        status="Assigned"
        history={[
          { from: null, to: 'Submitted', by: null, at: '2026-10-20T10:00:00.000Z' },
          { from: 'Submitted', to: 'Under Review', by: null, at: '2026-10-20T10:00:00.000Z' },
          { from: 'Under Review', to: 'Assigned', by: null, at: '2026-10-21T10:00:00.000Z' },
        ]}
      />,
    );
    const steps = within(screen.getByRole('list', { name: 'Progress: Assigned' })).getAllByRole(
      'listitem',
    );
    expect(steps.map((s) => s.textContent)).toEqual([
      expect.stringContaining('(done)'),
      expect.stringContaining('(done)'),
      expect.stringContaining('(current)'),
      expect.stringContaining('(not yet)'),
      expect.stringContaining('(not yet)'),
    ]);
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
    expect(steps[2]).toHaveTextContent('21 Oct 2026');
  });

  it('shows resolved as complete and explains a reopened ticket', () => {
    const { rerender } = render(<TicketProgress status="Resolved" />);
    expect(screen.getAllByText(/\(done\)/)).toHaveLength(5);
    rerender(<TicketProgress status="Reopened" />);
    expect(screen.getByText(/Reopened after being resolved/)).toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  it('shows the admin menu with the active page and live counters', async () => {
    const stats = { needsReview: 3, pendingDuplicates: 1 } as Partial<StatsDTO>;
    mockApi([['/api/admin/stats', () => jsonResponse({ stats })]]);
    renderWithProviders(<Sidebar user={admin} />, {
      user: admin,
      route: '/admin/tickets?needsReview=true',
    });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /review queue/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /all tickets/i })).not.toHaveAttribute(
      'aria-current',
    );
    expect(await within(nav).findByText('3')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /duplicates/i })).toHaveTextContent('1');
  });

  it('shows students only student pages', () => {
    mockApi([]);
    renderWithProviders(<Sidebar user={studentUser} />, { user: studentUser, route: '/student' });
    const links = within(screen.getByRole('navigation', { name: 'Main' }))
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(links).toEqual(['Dashboard', 'My complaints', 'Report a problem', 'Notifications']);
  });
});

describe('Topbar', () => {
  it('profile menu works with the keyboard and logs out', async () => {
    mockApi([
      [
        '/api/notifications',
        () => jsonResponse({ items: [], total: 0, page: 1, pages: 1, unreadCount: 0 }),
      ],
    ]);
    const onLogout = vi.fn();
    renderWithProviders(<Topbar user={admin} onMenu={() => {}} onLogout={onLogout} />, {
      user: admin,
    });
    const trigger = screen.getByRole('button', { name: /account menu: demo admin/i });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('admin@x.test')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'My dashboard' })).toHaveFocus(); // focus moves into the menu
    await userEvent.keyboard('{End}{Enter}');
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('Accept suggestion', () => {
  const ai: AiAnalysisDTO = {
    view: 'full',
    source: 'fallback_rules',
    model: null,
    valid: true,
    error: 'not_configured',
    category: 'Electrical',
    priority: 'High',
    confidence: 0.6,
    summary: 'Fan broken',
    extractedLocation: null,
    keyDetails: [],
    categoryReason: 'fan',
    priorityReason: 'may fall',
    needsClarification: false,
    clarificationQuestion: null,
    safetyRisk: false,
    recommendedDepartment: { id: 'd1', name: 'Electrical Maintenance' },
    processedAt: new Date().toISOString(),
  };

  it('uses the normal classify + assign endpoints with the suggested values', async () => {
    const spy = mockApi([
      ['/classification', () => jsonResponse({ ticket: ticketFixture() })],
      ['/assign', () => jsonResponse({ ticket: ticketFixture({ status: 'Assigned' }) })],
      ['/api/admin/departments', () => jsonResponse({ departments: [] })],
    ]);
    renderWithProviders(
      <AdminRoutingPanel
        ticket={ticketFixture({ status: 'Under Review', needsReview: true, department: null, ai })}
      />,
      { user: admin },
    );
    expect(screen.getByText(/60% confident/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /accept suggestion/i }));
    const calls = spy.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([url, init]) => [String(url).split('/').pop(), JSON.parse(String(init!.body))]);
    expect(calls).toEqual([
      ['classification', { category: 'Electrical', priority: 'High' }],
      ['assign', { departmentId: 'd1', note: 'Suggestion accepted by an administrator' }],
    ]);
  });

  it('is not offered once a ticket has a department', () => {
    mockApi([['/api/admin', () => jsonResponse({ departments: [], staff: [] })]]);
    renderWithProviders(<AdminRoutingPanel ticket={ticketFixture({ needsReview: false, ai })} />, {
      user: admin,
    });
    expect(screen.queryByRole('button', { name: /accept suggestion/i })).not.toBeInTheDocument();
  });
});
