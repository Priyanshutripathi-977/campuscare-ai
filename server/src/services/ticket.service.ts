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
import { TicketModel, type TicketDoc } from '../models/Ticket';
import { DepartmentModel } from '../models/Department';
import { UserModel } from '../models/User';
import { getSettings } from '../models/Settings';
import { env } from '../config/env';
import { getAiProvider } from './ai/provider';
import { understandComplaint } from './ai/complaintUnderstanding';
import { decideRouting } from './routing.service';
import { detectDuplicates, duplicatesForTicket } from './duplicate.service';
import { notifyTicketEvent } from './notification.service';
import { HttpError } from '../utils/HttpError';
import { nextTicketId } from '../utils/ticketId';
import type { StoredImage } from '../middleware/upload';
import { toTicketDetail, toTicketSummary } from './ticket.dto';

export type Actor = NonNullable<Express.Request['user']>;

const DETAIL_POPULATE = [
  { path: 'student', select: 'name email' },
  { path: 'department', select: 'name' },
  { path: 'assignedTo', select: 'name' },
  { path: 'statusHistory.by', select: 'name role' },
  { path: 'updates.author', select: 'name role' },
  { path: 'ai.recommendedDepartment', select: 'name' },
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
  return toTicketDetail(ticket, actor.role, await duplicatesForTicket(actor, ticket));
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
  // 1. Save the complaint FIRST, so it is never lost even if the AI step fails.
  const ticket = await TicketModel.create({
    ticketId: await nextTicketId(now),
    student: actor.id,
    title: input.title,
    description: input.description,
    location: input.location,
    studentCategory: input.category ?? null,
    image,
    status: 'Submitted',
    statusHistory: [
      { from: null, to: 'Submitted', by: actor.id, note: 'Complaint submitted', at: now },
    ],
  });

  // 2. Understand + route it.
  await analyzeAndRoute(ticket);

  // 3. Look for similar open complaints (suggestions for an admin; never blocks submission).
  try {
    await detectDuplicates(ticket);
  } catch (err) {
    console.error('[duplicates] detection failed:', err);
  }
  return getTicketDetail(actor, ticket.ticketId);
}

/**
 * Runs the AI pipeline on a ticket and applies the routing policy.
 * Only tickets that are not yet with a department are (re)routed.
 */
export async function analyzeAndRoute(
  ticket: TicketDoc,
  trigger: 'submitted' | 'clarified' | 'rerun' = 'submitted',
) {
  const from = ticket.status as Status;
  const now = new Date();
  try {
    const followUps = ticket.updates
      .filter((u) => u.authorRole === 'student')
      .map((u) => u.message);
    const [ai, settings, departments] = await Promise.all([
      understandComplaint(
        {
          title: ticket.title,
          description: ticket.description,
          location: {
            building: ticket.location?.building ?? '',
            room: ticket.location?.room,
            details: ticket.location?.details,
          },
          studentCategory: ticket.studentCategory as Category | null,
          followUps,
        },
        getAiProvider(),
        { timeoutMs: env.AI_TIMEOUT_MS },
      ),
      getSettings(),
      DepartmentModel.find({ active: true }, 'name categories').lean(),
    ]);

    const decision = decideRouting({
      ai,
      studentCategory: ticket.studentCategory as Category | null,
      rules: settings.routing,
      departments: departments.map((d) => ({
        id: String(d._id),
        name: d.name,
        categories: d.categories as Category[],
      })),
    });

    // Store the validated analysis (suggestion) on the ticket.
    ticket.ai = {
      ...ai,
      extractedLocation: {
        building: ai.extractedLocation?.building ?? undefined,
        room: ai.extractedLocation?.room ?? undefined,
      },
      clarificationQuestion: ai.clarificationQuestion ?? null,
      recommendedDepartment: (decision.recommendedDepartment?.id ??
        null) as unknown as Types.ObjectId,
    };
    // Suggested category/priority are shown (and start the deadline clock) but only an
    // auto-route or an admin action actually sends the ticket to a department.
    ticket.category = ai.category;
    ticket.priority = ai.priority;
    ticket.priorityRank = PRIORITY_RANK[ai.priority];
    ticket.classification = { source: ai.source === 'gemini' ? 'ai' : 'rules', by: null, at: now };
    ticket.dueAt = new Date(ticket.createdAt.getTime() + settings.slaHours[ai.priority] * 3600_000);

    const label =
      trigger === 'submitted'
        ? ''
        : trigger === 'clarified'
          ? ' (after student added details)'
          : ' (re-run by admin)';
    if (decision.autoRoute && decision.recommendedDepartment) {
      ticket.status = 'Assigned';
      ticket.department = decision.recommendedDepartment.id as unknown as Types.ObjectId;
      ticket.needsReview = false;
      ticket.reviewReasons = [];
      ticket.routing = {
        method: 'auto',
        decidedBy: null,
        reason: decision.explanation,
        decidedAt: now,
      };
      ticket.statusHistory.push({
        from,
        to: 'Assigned',
        by: null,
        note: `Automatically routed to ${decision.recommendedDepartment.name}${label}`,
        at: now,
      });
    } else {
      ticket.status = 'Under Review';
      ticket.needsReview = true;
      ticket.reviewReasons = decision.reviewReasons;
      ticket.routing = {
        method: 'admin_review',
        decidedBy: null,
        reason: decision.explanation,
        decidedAt: now,
      };
      if (from !== 'Under Review') {
        ticket.statusHistory.push({
          from,
          to: 'Under Review',
          by: null,
          note: ai.needsClarification
            ? 'More details needed — see the question on this ticket'
            : `Sent to an administrator for review${label}`,
          at: now,
        });
      }
    }
    await ticket.save();

    // Notifications (the submitting student already sees the result on screen).
    if (ticket.status === 'Assigned' && decision.recommendedDepartment) {
      await notifyTicketEvent(
        ticket,
        'ticket_assigned',
        `New ticket for ${decision.recommendedDepartment.name}: “${ticket.title}” (${ai.priority} priority).`,
        ['department'],
      );
      if (trigger !== 'submitted') {
        await notifyTicketEvent(
          ticket,
          'ticket_routed',
          `Your complaint was sent to ${decision.recommendedDepartment.name}.`,
          ['student'],
        );
      }
    } else if (ai.needsClarification && trigger !== 'submitted') {
      await notifyTicketEvent(
        ticket,
        'clarification_requested',
        `We need more details: ${ai.clarificationQuestion ?? 'please describe the problem in more detail.'}`,
        ['student'],
      );
    }
  } catch (err) {
    // Unexpected failure (e.g. database hiccup): never lose the ticket — send it to a human.
    console.error('[ai] analyzeAndRoute failed:', err);
    await TicketModel.updateOne(
      { _id: ticket._id, status: from },
      {
        $set: {
          status: 'Under Review',
          needsReview: true,
          reviewReasons: ['ai_unavailable'],
          routing: {
            method: 'admin_review',
            decidedBy: null,
            reason: 'Automatic analysis failed; an administrator will review it.',
            decidedAt: now,
          },
        },
        ...(from !== 'Under Review'
          ? {
              $push: {
                statusHistory: {
                  from,
                  to: 'Under Review',
                  by: null,
                  note: 'Sent to an administrator for review',
                  at: now,
                },
              },
            }
          : {}),
      },
    );
  }
}

/** Admin action: run the AI again (only for tickets still waiting in review). */
export async function rerunAnalysis(actor: Actor, ticketId: string) {
  const ticket = await findVisibleTicket(actor, ticketId);
  if (ticket.status !== 'Under Review' && ticket.status !== 'Submitted') {
    throw new HttpError(
      409,
      'AI analysis can only be re-run for tickets that are still under review',
    );
  }
  await analyzeAndRoute(ticket, 'rerun');
  return getTicketDetail(actor, ticketId);
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

  const preview = message.length > 120 ? `${message.slice(0, 117)}…` : message;
  if (actor.role === 'student') {
    await notifyTicketEvent(
      ticket,
      'update_added',
      `The student added an update: “${preview}”`,
      ['department'],
      actor.id,
    );
  } else {
    await notifyTicketEvent(
      ticket,
      'update_added',
      `${actor.name} replied: “${preview}”`,
      ['student'],
      actor.id,
    );
  }

  // If we asked the student for more details and they answered, analyse the ticket again.
  if (
    actor.role === 'student' &&
    ticket.status === 'Under Review' &&
    ticket.ai?.needsClarification
  ) {
    await analyzeAndRoute(ticket, 'clarified');
  }
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

  const studentMessage =
    to === 'Resolved'
      ? `Your complaint was marked as resolved: ${note}. If it is not fixed, you can reopen it.`
      : to === 'In Progress'
        ? 'Work has started on your complaint.'
        : `Your complaint's status changed to ${to}.`;
  await notifyTicketEvent(ticket, 'status_changed', studentMessage, ['student'], actor.id);
  if (to === 'Under Review') {
    await notifyTicketEvent(
      ticket,
      'sent_back_for_review',
      `${actor.name} sent this ticket back for review${note ? `: ${note}` : '.'}`,
      ['admins'],
      actor.id,
    );
  }
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
  await notifyTicketEvent(
    ticket,
    'ticket_reopened',
    `The student reopened this ticket: ${reason}`,
    ['department'],
    actor.id,
  );
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
  ticket.dueAt = new Date(ticket.createdAt.getTime() + settings.slaHours[priority] * 3600_000);
  // The admin has now confirmed the category/priority, so AI-related doubts are resolved.
  ticket.reviewReasons = ticket.reviewReasons.filter(
    (r) =>
      ![
        'awaiting_classification',
        'low_confidence',
        'ai_unavailable',
        'student_category_mismatch',
        'critical_priority',
        'review_category',
      ].includes(r),
  );
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

  await notifyTicketEvent(
    ticket,
    'ticket_routed',
    `Your complaint was ${isReassignment ? 'moved' : 'sent'} to ${department.name}.`,
    ['student'],
    actor.id,
  );
  await notifyTicketEvent(
    ticket,
    'ticket_assigned',
    `${ticket.assignedTo ? 'Assigned to you' : `New ticket for ${department.name}`}: “${ticket.title}” (${ticket.priority} priority).`,
    ['department'],
    actor.id,
  );
  return getTicketDetail(actor, ticketId);
}
