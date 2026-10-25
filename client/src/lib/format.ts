/** Formatting helpers for dates and labels shown in the UI. */

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

/** "3 hours ago", "in 2 days" … */
export function relativeTime(iso: string, now = Date.now()) {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return 'just now';
}

export function formatLocation(loc: { building: string; room?: string; details?: string }) {
  return [loc.building, loc.room].filter(Boolean).join(' · ');
}

export const REVIEW_REASON_LABELS: Record<string, string> = {
  awaiting_classification: 'Waiting for category and priority',
  ai_unavailable: 'AI unavailable — keyword classifier used',
  low_confidence: 'AI was not confident enough',
  needs_clarification: 'Waiting for more details from the student',
  critical_priority: 'Critical — needs human confirmation',
  review_category: 'Category always reviewed by an admin',
  no_department_for_category: 'No department mapped to this category',
  student_category_mismatch: "AI disagrees with the student's category",
  sent_back_for_review: 'Sent back to admin by staff',
};

export const AI_ERROR_LABELS: Record<string, string> = {
  not_configured: 'No Gemini API key configured',
  timeout: 'Gemini did not answer in time',
  rate_limited: 'Gemini rate limit reached',
  auth_failed: 'Gemini rejected the API key',
  provider_unavailable: 'Gemini service unavailable',
  provider_error: 'Gemini request failed',
  empty_response: 'Gemini returned an empty answer',
  invalid_json: 'Gemini returned invalid JSON',
};

export const aiErrorLabel = (e: string) =>
  AI_ERROR_LABELS[e] ??
  (e.startsWith('schema_validation_failed')
    ? `Gemini answer failed validation (${e.split(': ')[1] ?? ''})`
    : e);
