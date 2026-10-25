/**
 * Validation rules shared by the browser (instant feedback) and the server (the real check —
 * the server never trusts the browser). Built with zod.
 */
import { z } from 'zod';
import { CATEGORIES, PRIORITIES, STATUSES } from './constants';

/** Trims text and treats an empty string as "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// ---------- Auth ----------

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(80),
  email: z.email('Enter a valid email address').trim().toLowerCase().max(120),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  studentId: optionalText(30),
});
export type RegisterInput = z.input<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Enter your password').max(72),
});
export type LoginInput = z.input<typeof LoginSchema>;

// ---------- Tickets ----------

export const CreateTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(120, 'Title must be at most 120 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Please describe the problem in at least 20 characters')
    .max(2000, 'Description must be at most 2000 characters'),
  location: z.object({
    building: z.string().trim().min(2, 'Enter the building or area').max(80),
    room: optionalText(40),
    details: optionalText(200),
  }),
  // Optional: if the student is not sure, the system/admin decides.
  category: z
    .enum(CATEGORIES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
export type CreateTicketInput = z.input<typeof CreateTicketSchema>;

export const AddUpdateSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, 'Write a short message')
    .max(1000, 'Message must be at most 1000 characters'),
});

export const StatusChangeSchema = z
  .object({
    status: z.enum(STATUSES),
    note: optionalText(500),
    confirm: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === 'Resolved') {
      if (val.confirm !== true) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirm'],
          message: 'Resolving a ticket must be explicitly confirmed',
        });
      }
      if (!val.note || val.note.length < 5) {
        ctx.addIssue({
          code: 'custom',
          path: ['note'],
          message: 'Describe how the problem was resolved (at least 5 characters)',
        });
      }
    }
    // Sending a ticket back to an admin must say why, so the admin can act on it.
    if (val.status === 'Under Review' && (!val.note || val.note.length < 5)) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Explain why this ticket needs admin review (at least 5 characters)',
      });
    }
  });
export type StatusChangeInput = z.input<typeof StatusChangeSchema>;

export const ReopenSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Explain why the problem is not solved (at least 5 characters)')
    .max(500),
});

export const ClassificationSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
});

export const AssignSchema = z.object({
  departmentId: objectId,
  assignedTo: objectId.nullable().optional(),
  note: optionalText(300),
});

export const TICKET_SORTS = ['newest', 'oldest', 'priority', 'due'] as const;

export const TicketQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  department: objectId.optional(),
  overdue: z.enum(['true', 'false']).optional(),
  needsReview: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(TICKET_SORTS).default('newest'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TicketQuery = z.input<typeof TicketQuerySchema>;

/** Turns zod issues into { field: message } — used to show errors next to form fields. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
