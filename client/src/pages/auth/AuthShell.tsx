import type { ReactNode } from 'react';
import { SystemStatus } from '../../components/SystemStatus';

/** Centered card layout shared by the login and registration pages. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        CampusCare AI
      </div>
      <main className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </main>
      <div className="mt-6 w-full max-w-md">
        <SystemStatus />
      </div>
    </div>
  );
}
