/**
 * Ticket business rules. Routes call these functions; all permission checks and the
 * status state machine live here so they cannot be bypassed by a different route.
 */
import { Types } from 'mongoose';
import {
  canTransition,
  PRIORITY_RANK,
  type Category,
  type Priority,
  type Status,
  type TicketQuery,
  TicketQuerySchema,
} from '@campuscare/shared';
import type { z } from 'zod';
import { TicketModel } from '../models/Ticket';
import { DepartmentModel } from '../models/Department';
import { UserModel } from '../models/User';
import { getSettings } from '../models/Settings';
import { HttpError } from '../utils/HttpError';
import { nextTicketId } from '../utils/ticketId';
import type { StoredImage } from '../middleware/upload';
import { toTicketDetail, toTicketSummary } from './ticket.dto';

const DEFAULT_SLA_HOURS: Record<Priority, number> = { Critical: 4, High: 24, Medium: 72, Low: 168 };

export type Actor = NonNullable<Express.Request['user']>;

const DETAIL_POPULATE = [
  { path: 'student', select: 'name email' },
  { path: 'department', select: 'name' },
  { path: 'assignedTo', select: 'name' },
  { path: 'statusHistory.by', select: 'name role' },
  { path: 'updates.author', select: 'name role' },
];

/** MongoDB filter limiting tickets to what this user may see. */
export function visibilityFilter(actor: Actor): Record<string, unknown> {
  if (actor.role === 'admin') return {};
  // Staff without a department see nothing (a fresh random id matches no ticket).
  if (actor.role === 'staff') return { department: actor.departmentId ?? new Types.ObjectId() };
  return { student: actor.id };
}

/** Loads a ticket the actor may see, or throws 404 (we don't reveal that others' tickets exist). */
async function findVisibleTicket(actor: Actor, ticketId: string) {
  const ticket = await TicketModel.findOne({ ticketId, ...visibilityFilter(actor) });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  return ticket;
}

export async function getTicketDetail(actor: Actor, ticketId: string) {
  const ticket = await TicketModel.findOne({ ticketId, ...visibilityFilter(actor) })
    .populate(DETAIL_POPULATE)
    .lean();
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  return toTicketDetail(ticket, actor.role);
}

export async function getTicketImage(actor: Actor, ticketId: string) {
  const ticket = await findVisibleTicket(actor, ticketId);
  if (!ticket.image) throw new HttpError(404, 'This ticket has no image');
  return ticket.image;
}

// ---------- Create ----------

interface CreateInput {
  title: string;
  description: string;
  location: { building: string; room?: string; details?: string };
  category?: Category;
}

export async function createTicket(actor: Actor, input: CreateInput, image: StoredImage | null) {
  const now = new Date();
  const ticket = await TicketModel.create({
    ticketId: await nextTicketId(now),
    student: actor.id,
    title: input.title,
    description: input.description,
    location: input.location,
    studentCategory: input.category ?? null,
    image,
    // AI classification is added in a later milestone. Until then, every new complaint
    // goes to an administrator, who classifies and routes it manually.
    status: 'Under Review',
    needsReview: true,
    reviewReasons: ['awaiting_classification'],
    routing: {
      method: 'admin_review',
      reason: 'Automatic classification is not enabled yet; an administrator will review it.',
      decidedAt: now,
    },
    statusHistory: [
      { from: null, to: 'Submitted', by: actor.id, note: 'Complaint submitted', at: now },
      {
        from: 'Submitted',
        to: 'Under Review',
        by: null,
        note: 'Sent to an administrator for classification',
        at: now,
      },
    ],
  });
  return getTicketDetail(actor, ticket.ticketId);
}

// ---------- List ----------

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listTickets(actor: Actor, rawQuery: z.output<typeof TicketQuerySchema>) {
  const q = rawQuery;
  const filter: Record<string, unknown> = { ...visibilityFilter(actor) };
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  if (q.priority) filter.priority = q.priority;
  if (q.department && actor.role === 'admin') filter.department = q.department;
  if (q.needsReview) filter.needsReview = q.needsReview === 'true';
  if (q.overdue === 'true') {
    filter.dueAt = { $lt: new Date() };
    filter.status = q.status && q.status !== 'Resolved' ? q.status : { $ne: 'Resolved' };
  }
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ ticketId: re }, { title: re }, { 'location.building': re }];
  }

  const sort: Record<string, 1 | -1> =
    q.sort === 'oldest'
      ? { createdAt: 1 }
      : q.sort === 'priority'
        ? { priorityRank: -1, createdAt: -1 }
        : q.sort === 'due'
          ? { dueAt: 1, createdAt: -1 }
          : { createdAt: -1 };

  const [items, total] = await Promise.all([
    TicketModel.find(filter)
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate({ path: 'department', select: 'name' })
      .lean(),
    TicketModel.countDocuments(filter),
  ]);

  return {
    items: items.map(toTicketSummary),
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  };
}
export type { TicketQuery };

// ---------- Updates (comments) ----------

export async function addUpdate(actor: Actor, ticketId: string, message: string) {
  const ticket = await findVisibleTicket(actor, ticketId);
  ticket.updates.push({ author: actor.id, authorRole: actor.role, message, at: new Date() });
  await ticket.save();
  return getTicketDetail(actor, ticketId);
}

// ---------- Status changes ----------

export async function changeStatus(
  actor: Actor,
  ticketId: string,
  to: Status,
  note: string | undefined,
) {
  if (actor.role === 'student') throw new HttpError(403, 'Only staff can change ticket status');
  const ticket = await findVisibleTicket(actor, ticketId);
  const from = ticket.status as Status;

  if (!canTransition(actor.role, from, to)) {
    throw new HttpError(409, `Cannot change status from "${from}" to "${to}"`);
  }

  const now = new Date();
  const set: Record<string, unknown> = { status: to };
  if (to === 'Resolved') set.resolvedAt = now;
  if (to === 'Under Review') {
    set.needsReview = true;
    set.reviewReasons = ['sent_back_for_review'];
  }

  // The { status: from } condition makes this safe if two people click at the same moment.
  const updated = await TicketModel.findOneAndUpdate(
    { _id: ticket._id, status: from },
    { $set: set, $push: { statusHistory: { from, to, by: actor.id, note, at: now } } },
  );
  if (!updated)
    throw new HttpError(409, 'The ticket was changed by someone else. Refresh and try again.');
  return getTicketDetail(actor, ticketId);
}

export async function reopenTicket(actor: Actor, ticketId: string, reason: string) {
  if (actor.role !== 'student')
    throw new HttpError(403, 'Only the student who reported it can reopen a ticket');
  const ticket = await findVisibleTicket(actor, ticketId);
  if (ticket.status !== 'Resolved')
    throw new HttpError(409, 'Only resolved tickets can be reopened');

  const now = new Date();
  const updated = await TicketModel.findOneAndUpdate(
    { _id: ticket._id, status: 'Resolved' },
    {
      $set: { status: 'Reopened', resolvedAt: null },
      $push: {
        statusHistory: { from: 'Resolved', to: 'Reopened', by: actor.id, note: reason, at: now },
      },
    },
  );
  if (!updated)
    throw new HttpError(409, 'The ticket was changed by someone else. Refresh and try again.');
  return getTicketDetail(actor, ticketId);
}

// ---------- Admin: classify & assign ----------

export async function classifyTicket(
  actor: Actor,
  ticketId: string,
  category: Category,
  priority: Priority,
) {
  const ticket = await findVisibleTicket(actor, ticketId);
  if (ticket.status === 'Resolved')
    throw new HttpError(409, 'Resolved tickets cannot be reclassified');

  const settings = await getSettings();
  const now = new Date();
  ticket.category = category;
  ticket.priority = priority;
  ticket.priorityRank = PRIORITY_RANK[priority];
  ticket.classification = { source: 'admin', by: actor.id as unknown as Types.ObjectId, at: now };
  // Deadline counts from when the complaint was submitted, not when it was classified.
  const slaHours = settings.slaHours?.[priority] ?? DEFAULT_SLA_HOURS[priority];
  ticket.dueAt = new Date(ticket.createdAt.getTime() + slaHours * 3600_000);
  ticket.reviewReasons = ticket.reviewReasons.filter((r) => r !== 'awaiting_classification');
  await ticket.save();
  return getTicketDetail(actor, ticketId);
}

export async function assignTicket(
  actor: Actor,
  ticketId: string,
  departmentId: string,
  assignedTo: string | null | undefined,
  note: string | undefined,
) {
  const ticket = await findVisibleTicket(actor, ticketId);
  if (ticket.status === 'Resolved')
    throw new HttpError(409, 'Resolved tickets cannot be reassigned');
  if (!ticket.category || !ticket.priority) {
    throw new HttpError(409, 'Set the category and priority before assigning this ticket');
  }

  const department = await DepartmentModel.findOne({ _id: departmentId, active: true }).lean();
  if (!department)
    throw new HttpError(400, 'Department not found', {
      fieldErrors: { departmentId: 'Choose a valid department' },
    });

  if (assignedTo) {
    const staff = await UserModel.findOne({
      _id: assignedTo,
      role: 'staff',
      department: departmentId,
    }).lean();
    if (!staff) {
      throw new HttpError(400, 'That staff member does not belong to the selected department', {
        fieldErrors: { assignedTo: 'Choose a staff member from the selected department' },
      });
    }
  }

  const now = new Date();
  const from = ticket.status as Status;
  const isReassignment = from === 'Assigned' || from === 'In Progress';
  const to: Status = isReassignment ? from : 'Assigned';

  ticket.department = department._id;
  ticket.assignedTo = (assignedTo ?? null) as unknown as Types.ObjectId;
  ticket.status = to;
  ticket.needsReview = false;
  ticket.reviewReasons = [];
  ticket.routing = {
    method: 'manual',
    decidedBy: actor.id as unknown as Types.ObjectId,
    reason: note ?? `Assigned to ${department.name} by an administrator`,
    decidedAt: now,
  };
  ticket.statusHistory.push({
    from,
    to,
    by: actor.id as unknown as Types.ObjectId,
    note: `${isReassignment ? 'Reassigned' : 'Assigned'} to ${department.name}${note ? ` — ${note}` : ''}`,
    at: now,
  });
  await ticket.save();
  return getTicketDetail(actor, ticketId);
}
