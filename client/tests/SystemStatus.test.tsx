import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { SystemStatus } from '../src/components/SystemStatus';
import { renderWithProviders } from './renderWithProviders';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const health = (overrides = {}) => ({
  status: 'ok',
  database: 'connected',
  uptimeSeconds: 5,
  aiConfigured: false,
  time: '',
  ...overrides,
});

describe('SystemStatus', () => {
  it('shows a loading state, then the live server and database status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(health()));
    renderWithProviders(<SystemStatus />);

    expect(screen.getByRole('status')).toHaveTextContent(/checking server/i);
    expect(await screen.findByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/rule-based fallback/i)).toBeInTheDocument();
  });

  it('shows the database as unavailable when the API reports 503', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(health({ status: 'degraded', database: 'disconnected' }), 503),
    );
    renderWithProviders(<SystemStatus />);

    expect(await screen.findByText(/unavailable \(disconnected\)/i)).toBeInTheDocument();
  });

  it('shows an error with a retry button when the server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderWithProviders(<SystemStatus />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('treats a non-JSON proxy error (API server stopped) as unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    renderWithProviders(<SystemStatus />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
  });
});
