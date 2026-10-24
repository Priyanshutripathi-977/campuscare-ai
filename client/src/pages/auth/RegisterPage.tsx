import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { fieldErrors, RegisterSchema } from '@campuscare/shared';
import { register } from '../../api/auth';
import { ApiError } from '../../api/client';
import { homePathFor, useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Alert';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    studentId: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: async (u) => {
      await setUser(u);
      // No navigate() here: once the user is set, this page re-renders and its
      // <Navigate> below redirects (a second navigation caused a flicker/remount).
    },
    onError: (err) =>
      setErrors(
        err instanceof ApiError
          ? { ...err.fieldErrors, _form: err.message }
          : { _form: 'Registration failed' },
      ),
  });

  if (user) return <Navigate to={homePathFor(user)} replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { confirm, ...data } = form;
    const parsed = RegisterSchema.safeParse(data);
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (confirm !== form.password) errs.confirm = 'Passwords do not match';
    if (!parsed.success || errs.confirm) return setErrors(errs);
    setErrors({});
    mutation.mutate(parsed.data);
  };

  return (
    <AuthShell
      title="Create a student account"
      subtitle="Staff and admin accounts are created by the administration."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors._form && <Alert tone="error">{errors._form}</Alert>}
        <TextField
          label="Full name"
          autoComplete="name"
          required
          value={form.name}
          onChange={set('name')}
          error={errors.name}
        />
        <TextField
          label="College email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
          error={errors.email}
        />
        <TextField
          label="Student ID / Roll number"
          value={form.studentId}
          onChange={set('studentId')}
          error={errors.studentId}
          hint="Stored privately with your account; never shown on dashboards."
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
