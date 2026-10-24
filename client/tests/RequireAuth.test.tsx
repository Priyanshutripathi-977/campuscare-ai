import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { RequireAuth } from '../src/components/RequireAuth';
import { jsonResponse, mockApi, renderWithProviders, studentUser } from './renderWithProviders';

describe('RequireAuth', () => {
  it('redirects to the login page when nobody is logged in', async () => {
    mockApi([['/api/auth/me', () => jsonResponse({ error: { message: 'Please log in' } }, 401)]]);
    renderWithProviders(
      <RequireAuth>
        <p>Secret</p>
      </RequireAuth>,
    );
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('does not show admin pages to students', async () => {
    mockApi([]);
    renderWithProviders(
      <RequireAuth roles={['admin']}>
        <p>Admin only</p>
      </RequireAuth>,
      { user: studentUser },
    );
    expect(screen.queryByText('Admin only')).not.toBeInTheDocument();
  });

  it('shows the page to an allowed role', () => {
    mockApi([]);
    renderWithProviders(
      <RequireAuth roles={['student']}>
        <p>Student page</p>
      </RequireAuth>,
      { user: studentUser },
    );
    expect(screen.getByText('Student page')).toBeInTheDocument();
  });
});
