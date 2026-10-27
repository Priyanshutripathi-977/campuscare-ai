import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api/health';
import { Card } from './ui/Card';
import { Spinner } from './ui/Spinner';

/** Shows real, live server status from GET /api/health (no fake data). */
export function SystemStatus() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
  });

  return (
    <Card>
      <h2 className="text-sm font-semibold text-navy-900">System status</h2>
      <div className="mt-4">
        {isPending && <Spinner label="Checking server…" />}

        {isError && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 font-medium text-red-800 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-500">API server</dt>
            <dd className="font-medium text-emerald-700">Online</dd>
            <dt className="text-slate-500">Database</dt>
            <dd
              className={`font-medium ${data.database === 'connected' ? 'text-emerald-700' : 'text-red-700'}`}
            >
              {data.database === 'connected' ? 'Connected' : `Unavailable (${data.database})`}
            </dd>
            <dt className="text-slate-500">AI classifier</dt>
            <dd className="font-medium">
              {data.aiConfigured ? 'Gemini configured' : 'Rule-based fallback (no API key)'}
            </dd>
          </dl>
        )}
      </div>
    </Card>
  );
}
