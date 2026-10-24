import { ButtonLink } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-mono text-sm text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you're looking for doesn't exist.</p>
      <ButtonLink to="/" className="mt-6">
        Go home
      </ButtonLink>
    </div>
  );
}
