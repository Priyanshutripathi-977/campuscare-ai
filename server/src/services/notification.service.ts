/**
 * Creates in-app notifications for ticket events and (optionally) emails them.
 *
 * Rules:
 *  - The person who performed an action is never notified about it.
 *  - Notification problems never break the action that triggered them.
 *  - Email status is stored as it really happened (not_configured / pending / sent / failed).
 */
import type { Types } from 'mongoose';
import { env } from '../config/env';
import { NotificationModel, type NotificationType } from '../models/Notification';
import { UserModel } from '../models/User';
import { getMailer } from './mailer';

export interface TicketRef {
  _id: Types.ObjectId | string;
  ticketId: string;
  title: string;
  student: Types.ObjectId | string;
  department?: Types.ObjectId | string | null;
  assignedTo?: Types.ObjectId | string | null;
}

type Audience = 'student' | 'department' | 'admins';

/** Emails still being sent — tests await this; the app never waits for email. */
const inFlight = new Set<Promise<void>>();
export async function flushEmails() {
  while (inFlight.size) await Promise.all([...inFlight]);
}

async function resolveAudience(ticket: TicketRef, audience: Audience[]): Promise<string[]> {
  const ids = new Set<string>();
  for (const a of audience) {
    if (a === 'student') ids.add(String(ticket.student));
    if (a === 'department') {
      if (ticket.assignedTo) ids.add(String(ticket.assignedTo));
      else if (ticket.department) {
        const staff = await UserModel.find(
          { role: 'staff', department: ticket.department },
          '_id',
        ).lean();
        staff.forEach((s) => ids.add(String(s._id)));
      }
    }
    if (a === 'admins') {
      const admins = await UserModel.find({ role: 'admin' }, '_id').lean();
      admins.forEach((s) => ids.add(String(s._id)));
    }
  }
  return [...ids];
}

/**
 * Notify an audience about something that happened to a ticket.
 * Safe to call from anywhere: errors are logged, never thrown.
 */
export async function notifyTicketEvent(
  ticket: TicketRef,
  type: NotificationType,
  message: string,
  audience: Audience[],
  actorId?: string | null,
): Promise<number> {
  try {
    const recipients = (await resolveAudience(ticket, audience)).filter((id) => id !== actorId);
    if (recipients.length === 0) return 0;

    const mailer = getMailer();
    const docs = await NotificationModel.insertMany(
      recipients.map((user) => ({
        user,
        ticket: ticket._id,
        type,
        message: message.slice(0, 400),
        email: { status: mailer ? 'pending' : 'not_configured' },
      })),
    );

    if (mailer) {
      // Send in the background so the user's request is not slowed down by email.
      const job = sendEmails(
        docs.map((d) => String(d._id)),
        ticket,
        message,
      ).finally(() => inFlight.delete(job));
      inFlight.add(job);
    }
    return docs.length;
  } catch (err) {
    console.error('[notifications] could not create notifications:', err);
    return 0;
  }
}

async function sendEmails(notificationIds: string[], ticket: TicketRef, message: string) {
  const mailer = getMailer();
  if (!mailer) return;
  const link = `${env.APP_URL ?? env.CLIENT_ORIGIN}/tickets/${ticket.ticketId}`;
  for (const id of notificationIds) {
    try {
      const n = await NotificationModel.findById(id).populate<{ user: { email: string } }>(
        'user',
        'email',
      );
      if (!n?.user?.email) continue;
      const result = await mailer.send({
        to: n.user.email,
        subject: `[CampusCare] ${ticket.ticketId}: ${message.slice(0, 80)}`,
        text: `${message}\n\nTicket: ${ticket.ticketId} — ${ticket.title}\nView it here: ${link}\n\nYou are receiving this because you are involved in this ticket.`,
      });
      await NotificationModel.updateOne(
        { _id: id },
        result.ok
          ? { $set: { 'email.status': 'sent', 'email.sentAt': new Date(), 'email.error': null } }
          : { $set: { 'email.status': 'failed', 'email.error': result.error } },
      );
    } catch (err) {
      await NotificationModel.updateOne(
        { _id: id },
        {
          $set: {
            'email.status': 'failed',
            'email.error': String((err as Error).message).slice(0, 300),
          },
        },
      ).catch(() => {});
    }
  }
}
