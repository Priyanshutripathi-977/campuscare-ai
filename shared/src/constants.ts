/**
 * Values shared by the client and the server.
 * Keeping them in one place means the dropdowns in the UI and the
 * validation on the server can never disagree.
 */

export const CATEGORIES = [
  'IT',
  'Electrical',
  'Plumbing',
  'Housekeeping',
  'Classroom Facilities',
  'Security',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Reopened',
] as const;
export type Status = (typeof STATUSES)[number];

export const ROLES = ['student', 'staff', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Statuses that count as "still open" (not finished). */
export const OPEN_STATUSES: readonly Status[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Reopened',
];

/** Higher number = more urgent. Used for sorting. */
export const PRIORITY_RANK: Record<Priority, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

/**
 * The ticket "state machine": which status may follow which.
 * The server enforces this; the UI uses it to show only valid buttons.
 * (Moving to "Assigned" happens through the assign action, which also picks a department.)
 */
export const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  Submitted: ['Under Review'],
  'Under Review': [],
  Assigned: ['In Progress', 'Under Review'],
  'In Progress': ['Resolved', 'Under Review'],
  Resolved: ['Reopened'],
  Reopened: ['In Progress', 'Under Review'],
};

/** Transitions department staff may perform (admins may perform every allowed transition). */
export const STAFF_TRANSITIONS: readonly (readonly [Status, Status])[] = [
  ['Assigned', 'In Progress'],
  ['In Progress', 'Resolved'],
  ['Reopened', 'In Progress'],
];

export function canTransition(role: Role, from: Status, to: Status): boolean {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) return false;
  if (role === 'admin') return to !== 'Reopened'; // reopening is the student's decision
  if (role === 'staff') return STAFF_TRANSITIONS.some(([f, t]) => f === from && t === to);
  return false; // students use the dedicated reopen action instead
}

export const UPLOAD_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
