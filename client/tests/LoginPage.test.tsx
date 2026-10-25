import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider } from '../src/context/AuthContext';
import { RequireAuth } from '../src/components/RequireAuth';
import { LoginPage } from '../src/pages/auth/LoginPage';
import { jsonResponse, mockApi, studentUser } from './renderWithProviders';

function renderApp(entry: string | { pathname: string; state: unknown } = '/login') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/tickets/:id" element={<p>Ticket page</p>} />
            <Route
              path="/student"
              element={
                <RequireAuth roles={['student']}>
                  <p>Student home</p>
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fillAndSubmit = async () => {
  await userEvent.type(await screen.findByLabelText(/email/i), 'student@x.test');
  await userEvent.type(screen.getByLabelText(/password/i), 'Passw0rd!');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
};

describe('LoginPage', () => {
  // Regression test: login used to succeed on the server but leave the UI logged out.
  it('lands on the student home after a successful login', async () => {
    mockApi([
      [
        '/api/health',
        () =>
          jsonResponse({
            status: 'ok',
            database: 'connected',
            uptimeSeconds: 1,
            aiConfigured: false,
            time: '',
          }),
      ],
      ['/api/auth/me', () => jsonResponse({ error: { message: 'Please log in' } }, 401)],
      ['/api/auth/login', () => jsonResponse({ user: studentUser })],
    ]);
    renderApp();
    await fillAndSubmit();
    expect(await screen.findByText('Student home')).toBeInTheDocument();
  });

  // Regression test: the page you were sent away from was ignored after login.
  it('returns to the page the user originally asked for', async () => {
    mockApi([
      [
        '/api/health',
        () =>
          jsonResponse({
            status: 'ok',
            database: 'connected',
            uptimeSeconds: 1,
            aiConfigured: false,
            time: '',
          }),
      ],
      ['/api/auth/me', () => jsonResponse({ error: { message: 'Please log in' } }, 401)],
      ['/api/auth/login', () => jsonResponse({ user: studentUser })],
    ]);
    renderApp({ pathname: '/login', state: { from: '/tickets/CC-2026-000001' } });
    await fillAndSubmit();
    expect(await screen.findByText('Ticket page')).toBeInTheDocument();
  });

  // Regression test: a slow "who am I?" answer arriving AFTER login used to log the user out again.
  it('stays logged in when the initial session check answers late', async () => {
    let answerMe!: () => void;
    mockApi([
      [
        '/api/health',
        () =>
          jsonResponse({
            status: 'ok',
            database: 'connected',
            uptimeSeconds: 1,
            aiConfigured: false,
            time: '',
          }),
      ],
      [
        '/api/auth/me',
        () =>
          new Promise<Response>((resolve) => {
            answerMe = () => resolve(jsonResponse({ error: { message: 'Please log in' } }, 401));
          }),
      ],
      ['/api/auth/login', () => jsonResponse({ user: studentUser })],
    ]);
    renderApp();
    await fillAndSubmit();
    expect(await screen.findByText('Student home')).toBeInTheDocument();
    answerMe(); // the stale "nobody is logged in" answer finally arrives
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Student home')).toBeInTheDocument();
  });

  it('shows the server error for wrong credentials', async () => {
    mockApi([
      [
        '/api/health',
        () =>
          jsonResponse({
            status: 'ok',
            database: 'connected',
            uptimeSeconds: 1,
            aiConfigured: false,
            time: '',
          }),
      ],
      ['/api/auth/me', () => jsonResponse({ error: { message: 'Please log in' } }, 401)],
      [
        '/api/auth/login',
        () => jsonResponse({ error: { message: 'Incorrect email or password' } }, 401),
      ],
    ]);
    renderApp();
    await fillAndSubmit();
    expect(await screen.findByText('Incorrect email or password')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password');
  });
});
