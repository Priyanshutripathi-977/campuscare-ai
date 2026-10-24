/** All pages and who may see them. */
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { homePathFor, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { PageLoader } from './components/ui/States';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { MyTicketsPage } from './pages/student/MyTicketsPage';
import { NewComplaintPage } from './pages/student/NewComplaintPage';
import { TicketDetailPage } from './pages/TicketDetailPage';

// Staff/admin pages (and the chart library they use) are downloaded only when needed,
// so students get a smaller, faster app.
const DashboardPage = lazy(() =>
  import('./pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const DuplicatesPage = lazy(() =>
  import('./pages/admin/DuplicatesPage').then((m) => ({ default: m.DuplicatesPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const TicketsPage = lazy(() =>
  import('./pages/admin/TicketsPage').then((m) => ({ default: m.TicketsPage })),
);
import { NotFoundPage } from './pages/NotFoundPage';

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          path="/student"
          element={
            <RequireAuth roles={['student']}>
              <MyTicketsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/student/new"
          element={
            <RequireAuth roles={['student']}>
              <NewComplaintPage />
            </RequireAuth>
          }
        />
        <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
        <Route
          path="/admin"
          element={
            <RequireAuth roles={['admin', 'staff']}>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/tickets"
          element={
            <RequireAuth roles={['admin', 'staff']}>
              <TicketsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/duplicates"
          element={
            <RequireAuth roles={['admin']}>
              <DuplicatesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAuth roles={['admin']}>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
