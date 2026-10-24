import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { fieldErrors, LoginSchema } from '@campuscare/shared';
import { login } from '../../api/auth';
import { ApiError } from '../../api/client';
import { homePathFor, useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (u) => {
      setUser(u);
      navigate(from ?? homePathFor(u), { replace: true });
    },
    onError: (err) =>
      setErrors(
        err instanceof ApiError
          ? { ...err.fieldErrors, _form: err.message }
          : { _form: 'Login failed' },
      ),
  });

  if (user) return <Navigate to={homePathFor(user)} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = LoginSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    mutation.mutate(parsed.data);
  };

  return (
    <AuthShell title="Log in" subtitle="Report campus problems and track their progress.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors._form && <Alert tone="error">{errors._form}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
        />
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New student?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">
            Demo accounts (development only — created by <code>npm run seed</code>)
          </p>
          <p className="mt-1">
            Password for all: <code>Demo@1234</code>
          </p>
          <ul className="mt-1 list-inside list-disc">
            <li>
              Student: <code>student@campuscare.test</code>
            </li>
            <li>
              Admin: <code>admin@campuscare.test</code>
            </li>
            <li>
              Staff (Electrical): <code>electrical.staff@campuscare.test</code>
            </li>
          </ul>
        </div>
      )}
    </AuthShell>
  );
}
