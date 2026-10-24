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
  sent_back_for_review: 'Sent back to admin by staff',
  low_confidence: 'AI was not confident',
};
