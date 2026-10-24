/**
 * Makes the logged-in user available to every component via useAuth().
 * The user comes from GET /api/auth/me (the cookie itself is unreadable to JavaScript).
 */
import { createContext, useContext, type ReactNode } from 'react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDTO } from '@campuscare/shared';
import { getMe, logout as apiLogout } from '../api/auth';

interface AuthState {
  user: UserDTO | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  setUser: (user: UserDTO | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Forget every cached ticket/stat from the previous user, but keep the ['me'] query
 * itself (clearing it would disconnect the components that are watching it).
 */
function switchUser(queryClient: QueryClient, user: UserDTO | null) {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
  queryClient.setQueryData(['me'], user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false, staleTime: 60_000 });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSettled: () => switchUser(queryClient, null),
  });

  const value: AuthState = {
    user: me.data ?? null,
    isLoading: me.isPending,
    error: me.error,
    refetch: () => void me.refetch(),
    setUser: (user) => switchUser(queryClient, user),
    logout: () => logoutMutation.mutateAsync(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Where each role lands after logging in. */
export const homePathFor = (user: UserDTO) => (user.role === 'student' ? '/student' : '/admin');
