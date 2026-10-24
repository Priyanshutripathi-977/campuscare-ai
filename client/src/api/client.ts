/**
 * Tiny wrapper around fetch() used by every API call.
 * - Sends cookies (the login session lives in an httpOnly cookie).
 * - Turns error responses into a thrown ApiError with the server's message
 *   and, for invalid forms, per-field error messages.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/**
 * @param acceptStatuses extra non-2xx statuses whose JSON body is still a valid answer
 *                       (e.g. the health check returns 503 + details when the DB is down).
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  acceptStatuses: number[] = [],
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is it running?');
  }

  const body = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null;

  if (!res.ok && !(body && acceptStatuses.includes(res.status))) {
    // A 5xx without our JSON error format means the dev proxy could not reach the API.
    if (res.status >= 500 && !body) {
      throw new ApiError(res.status, 'Cannot reach the server. Is it running?');
    }
    throw new ApiError(
      res.status,
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.error?.details?.fieldErrors ?? {},
    );
  }
  return body as T;
}

/** Sends a JSON body with the given method. */
export function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
) {
  return apiFetch<T>(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Builds "?a=1&b=2", skipping empty values. */
export function toQueryString(params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
