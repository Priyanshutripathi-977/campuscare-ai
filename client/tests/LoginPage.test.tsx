import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider } from '../src/context/AuthContext';
import { RequireAuth } from '../src/components/RequireAuth';
import { LoginPage } from '../src/pages/auth/LoginPage';
import { jsonResponse, mockApi, studentUser } from './renderWithProviders';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
