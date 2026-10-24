import type { LoginInput, RegisterInput, UserDTO } from '@campuscare/shared';
import { ApiError, apiFetch, apiSend } from './client';

/** Returns the logged-in user, or null when nobody is logged in. */
export async function getMe(): Promise<UserDTO | null> {
  try {
    return (await apiFetch<{ user: UserDTO }>('/auth/me')).user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export const login = (input: LoginInput) =>
  apiSend<{ user: UserDTO }>('POST', '/auth/login', input).then((r) => r.user);

export const register = (input: RegisterInput) =>
  apiSend<{ user: UserDTO }>('POST', '/auth/register', input).then((r) => r.user);

export const logout = () => apiSend<void>('POST', '/auth/logout');
