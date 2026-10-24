import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { UserDTO } from '@campuscare/shared';
import { vi } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';

interface Options {
  /** Pretend this user is logged in (skips the /auth/me request). null = logged out. */
  user?: UserDTO | null;
  route?: string;
  /** Route pattern the UI is mounted at, e.g. "/tickets/:ticketId". */
  path?: string;
}

/** Renders a component with a fresh React Query client, router and auth context. */
export function renderWithProviders(
  ui: ReactElement,
  { user, route = '/', path = '*' }: Options = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (user !== undefined) client.setQueryData(['me'], user);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** Mocks fetch with a list of [url-substring, handler] pairs. Unmatched calls fail the test loudly. */
export function mockApi(routes: [string, Handler][]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const match = routes.find(([part]) => url.includes(part));
    if (!match) throw new Error(`Unmocked request: ${init?.method ?? 'GET'} ${url}`);
    return match[1](url, init);
  });
}

export const studentUser: UserDTO = {
  id: 'u1',
  name: 'Test Student',
  email: 's@x.test',
  role: 'student',
  department: null,
};
export const staffUser: UserDTO = {
  id: 'u2',
  name: 'Test Staff',
  email: 'st@x.test',
  role: 'staff',
  department: { id: 'd1', name: 'Electrical Maintenance' },
};
