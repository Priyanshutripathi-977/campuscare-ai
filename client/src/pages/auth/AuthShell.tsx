import type { ReactNode } from 'react';
import { Bell, Copy, GitBranch, ShieldCheck } from 'lucide-react';
import { SystemStatus } from '../../components/SystemStatus';
import { Logo } from '../../components/layout/Sidebar';

const POINTS = [
  {
    icon: GitBranch,
    title: 'Routed to the right team',
    text: 'Each complaint is analysed and sent to the right department, or reviewed by an admin when unsure.',
  },
  {
    icon: Copy,
    title: 'Duplicates spotted',
    text: 'Repeated reports of the same problem are flagged so they are handled once.',
  },
  {
    icon: Bell,
    title: 'Always informed',
    text: 'Every status change shows up on your ticket and in your notifications.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'You only ever see your own complaints. Staff see only their department.',
  },
];

/** Two-panel layout shared by the login and registration pages. */
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
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      {/* Product panel (large screens) */}
      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-slate-300 lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"
        />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative mt-auto max-w-lg">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight !text-white">
            Campus problems, reported once and fixed faster.
          </h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium text-white">{t}</p>
                  <p className="text-sm text-slate-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-slate-500">
          CampusCare AI · college project demonstration
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center bg-hero-soft px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <main className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card animate-slide-up sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </main>
        <div className="mt-6 w-full max-w-md">
          <SystemStatus />
        </div>
      </div>
    </div>
  );
}
