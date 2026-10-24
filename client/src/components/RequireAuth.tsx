/** Route guard: only lets logged-in users with an allowed role see the page. */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from '@campuscare/shared';
import { homePathFor, useAuth } from '../context/AuthContext';
import { ErrorState, PageLoader } from './ui/States';

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, isLoading, error, refetch } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader label="Checking your session…" />;
  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState title="Could not check your session" error={error} onRetry={refetch} />
      </div>
    );
  }
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  return <>{children}</>;
}
