/**
 * Notifications: the right people are told about each event (never the person who acted),
 * users only see their own, and email results are recorded truthfully — including a real
 * SMTP round-trip against a local test mail server.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { SMTPServer } from 'smtp-server';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { NotificationModel, type NotificationType } from '../src/models/Notification';
import { TicketModel } from '../src/models/Ticket';
import { DepartmentModel } from '../src/models/Department';
import { setAiProvider } from '../src/services/ai/provider';
import { createSmtpMailerFor, setMailer } from '../src/services/mailer';
import { flushEmails } from '../src/services/notification.service';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createUser, loginAs, validComplaint } from './helpers/fixtures';
import { fakeProvider, goodAnswer } from './helpers/fakeAi';

const app = createApp({ rateLimits: { createTicket: 10_000 } });
let student: TestAgent,
  otherStudent: TestAgent,
  admin: TestAgent,
  sunita: TestAgent,
  ravi: TestAgent,
  itStaff: TestAgent;
const ids: Record<string, string> = {};

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
afterEach(() => {
  setMailer(undefined);
  setAiProvider(undefined);
  vi.restoreAllMocks();
});
beforeEach(async () => {
  await clearDatabase();
  const elec = await DepartmentModel.create({
    code: 'ELEC',
    name: 'Electrical',
    categories: ['Electrical'],
  });
  const it = await DepartmentModel.create({ code: 'IT', name: 'IT Services', categories: ['IT'] });
  ids.elec = String(elec._id);
  ids.it = String(it._id);
  ids.student = String((await createUser('student', 'student@x.test'))._id);
  await createUser('student', 'other@x.test');
  ids.admin = String((await createUser('admin', 'admin@x.test'))._id);
  ids.sunita = String((await createUser('staff', 'sunita@x.test', elec._id))._id);
  ids.ravi = String((await createUser('staff', 'ravi@x.test', elec._id))._id);
  ids.itStaff = String((await createUser('staff', 'it@x.test', it._id))._id);
  [student, otherStudent, admin, sunita, ravi, itStaff] = await Promise.all([
    loginAs(app, 'student@x.test'),
    loginAs(app, 'other@x.test'),
    loginAs(app, 'admin@x.test'),
    loginAs(app, 'sunita@x.test'),
    loginAs(app, 'ravi@x.test'),
    loginAs(app, 'it@x.test'),
  ]);
});

/** Who received notifications of a given type (by user id). */
async function recipients(type?: NotificationType) {
  const rows = await NotificationModel.find(type ? { type } : {}).lean();
  return rows.map((r) => String(r.user)).sort();
}
const sorted = (...xs: string[]) => [...xs].sort();

async function newTicket() {
  return (await student.post('/api/tickets').field('data', JSON.stringify(validComplaint))).body
    .ticket.ticketId as string;
}
async function assigned(assignedTo: string | null = ids.sunita!) {
  const id = await newTicket();
  await admin
    .patch(`/api/tickets/${id}/classification`)
    .send({ category: 'Electrical', priority: 'High' });
  await admin.patch(`/api/tickets/${id}/assign`).send({ departmentId: ids.elec, assignedTo });
  await NotificationModel.deleteMany({}); // start each scenario with an empty inbox
  return id;
}

describe('who gets notified', () => {
  it('assignment: the student and the assigned staff member — not the admin who did it, not other staff', async () => {
    const id = await newTicket();
    await admin
      .patch(`/api/tickets/${id}/classification`)
      .send({ category: 'Electrical', priority: 'High' });
    await admin
      .patch(`/api/tickets/${id}/assign`)
      .send({ departmentId: ids.elec, assignedTo: ids.sunita });
    expect(await recipients('ticket_routed')).toEqual([ids.student]);
    expect(await recipients('ticket_assigned')).toEqual([ids.sunita]);
    const all = await recipients();
    expect(all).not.toContain(ids.admin);
    expect(all).not.toContain(ids.ravi);
    expect(all).not.toContain(ids.itStaff);
    // …and through the API, the other staff members' inboxes are empty.
    expect((await ravi.get('/api/notifications')).body.total).toBe(0);
    expect((await itStaff.get('/api/notifications')).body.total).toBe(0);
  });

  it('assignment to a department without a person notifies all its staff', async () => {
    await assigned(null);
    const id = await newTicket();
    await admin
      .patch(`/api/tickets/${id}/classification`)
      .send({ category: 'Electrical', priority: 'High' });
    await admin.patch(`/api/tickets/${id}/assign`).send({ departmentId: ids.elec });
    expect(await recipients('ticket_assigned')).toEqual(sorted(ids.sunita!, ids.ravi!));
  });

  it('automatic routing notifies the department (the student already saw the result)', async () => {
    setAiProvider(fakeProvider(JSON.stringify(goodAnswer())).provider);
    await newTicket();
    expect(await recipients('ticket_assigned')).toEqual(sorted(ids.sunita!, ids.ravi!));
    expect(await recipients('ticket_routed')).toEqual([]);
  });

  it('status changes go to the student, with the resolution note', async () => {
    const id = await assigned();
    await sunita.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    await sunita
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'Resolved', confirm: true, note: 'Replaced the capacitor' });
    const rows = await NotificationModel.find({ type: 'status_changed' })
      .sort({ createdAt: 1 })
      .lean();
    expect(rows.map((r) => String(r.user))).toEqual([ids.student, ids.student]);
    expect(rows[1]!.message).toMatch(/resolved: Replaced the capacitor.*reopen/);
    expect(await recipients()).not.toContain(ids.sunita);
  });

  it('"send back for review" by staff alerts the admins, with the reason', async () => {
    const id = await assigned();
    const res = await sunita
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'Under Review', note: 'Wrong department' });
    expect(res.status).toBe(200);
    const rows = await NotificationModel.find({ type: 'sent_back_for_review' }).lean();
    expect(rows.map((r) => String(r.user))).toEqual([ids.admin]);
    expect(rows[0]!.message).toMatch(/sent this ticket back for review: Wrong department/);
    expect(await recipients('sent_back_for_review')).not.toContain(ids.sunita); // not the actor
  });

  it('reopening alerts the department; updates go to the other side', async () => {
    const id = await assigned();
    await TicketModel.updateOne({ ticketId: id }, { status: 'Resolved' });
    await student.post(`/api/tickets/${id}/reopen`).send({ reason: 'Fan stopped again' });
    expect(await recipients('ticket_reopened')).toEqual([ids.sunita]);

    await student.post(`/api/tickets/${id}/updates`).send({ message: 'It is making noise too.' });
    await sunita.post(`/api/tickets/${id}/updates`).send({ message: 'Coming at 3 pm.' });
    const updates = await NotificationModel.find({ type: 'update_added' })
      .sort({ createdAt: 1 })
      .lean();
    expect(updates.map((u) => String(u.user))).toEqual([ids.sunita, ids.student]);
    expect(updates[1]!.message).toMatch(/replied: “Coming at 3 pm.”/);
  });

  it('a notification failure never breaks the action', async () => {
    const id = await assigned();
    vi.spyOn(NotificationModel, 'insertMany').mockRejectedValueOnce(new Error('db hiccup'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await sunita.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    expect(res.status).toBe(200);
    expect((await TicketModel.findOne({ ticketId: id }).lean())!.status).toBe('In Progress');
  });
});

describe('notifications API', () => {
  it('lists only my own notifications with an unread count', async () => {
    const id = await assigned();
    await sunita.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    const mine = (await student.get('/api/notifications')).body;
    expect(mine).toMatchObject({ total: 1, unreadCount: 1 });
    expect(mine.items[0]).toMatchObject({
      type: 'status_changed',
      read: false,
      ticket: { ticketId: id },
      email: { status: 'not_configured' },
    });
    expect((await otherStudent.get('/api/notifications')).body.total).toBe(0);
  });

  it('marks one or all as read; other users cannot touch mine', async () => {
    const id = await assigned();
    await sunita.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    await sunita.post(`/api/tickets/${id}/updates`).send({ message: 'On the way' });
    const [first] = (await student.get('/api/notifications')).body.items;

    expect((await otherStudent.patch(`/api/notifications/${first.id}/read`)).status).toBe(404);
    expect((await admin.patch(`/api/notifications/${first.id}/read`)).status).toBe(404);
    expect((await student.patch(`/api/notifications/${first.id}/read`)).status).toBe(200);
    expect((await student.get('/api/notifications')).body.unreadCount).toBe(1);
    expect((await student.get('/api/notifications?unread=true')).body.total).toBe(1);

    expect((await student.post('/api/notifications/read-all')).body.updated).toBe(1);
    expect((await student.get('/api/notifications')).body.unreadCount).toBe(0);
    const saved = await NotificationModel.find({ user: ids.student }).lean();
    expect(saved.every((n) => n.read && n.readAt instanceof Date)).toBe(true);
  });

  it('rejects bad input and anonymous users', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await student.patch('/api/notifications/not-an-id/read')).status).toBe(400);
    expect((await student.get('/api/notifications?limit=500')).status).toBe(400);
    expect((await student.get('/api/notifications?unread=maybe')).status).toBe(400);
  });
});

describe('email delivery is recorded truthfully', () => {
  it('without SMTP: in-app only, marked "not_configured" (never "sent")', async () => {
    const id = await assigned();
    await sunita.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    await flushEmails();
    const n = await NotificationModel.findOne({ user: ids.student }).lean();
    expect(n!.email!).toMatchObject({ status: 'not_configured', sentAt: null });
  });

  it('with a real SMTP server: delivered and marked "sent"', async () => {
    const received: { to: string; data: string }[] = [];
    const server = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onData(stream, session, done) {
        let data = '';
        stream.on('data', (c: Buffer) => (data += c.toString()));
        stream.on('end', () => {
          received.push({ to: session.envelope.rcptTo.map((r) => r.address).join(','), data });
          done();
        });
      },
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.server.address() as AddressInfo;
    try {
      const id = await assigned(); // setup happens before email is switched on
      setMailer(createSmtpMailerFor('127.0.0.1', port));
      await sunita.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
      await flushEmails();

      const n = await NotificationModel.findOne({ user: ids.student }).lean();
      expect(n!.email!.status).toBe('sent');
      expect(n!.email!.sentAt).toBeInstanceOf(Date);
      expect(received).toHaveLength(1);
      expect(received[0]!.to).toBe('student@x.test');
      expect(received[0]!.data).toContain(id);
      expect(received[0]!.data).toContain('Work has started on your complaint.');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('when sending fails: the action still succeeds and the email is marked "failed" with the reason', async () => {
    const id = await assigned();
    setMailer(createSmtpMailerFor('127.0.0.1', 1)); // nothing listens on port 1
    const res = await sunita.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    expect(res.status).toBe(200);
    await flushEmails();
    const n = await NotificationModel.findOne({ user: ids.student }).lean();
    expect(n!.email!.status).toBe('failed');
    expect(n!.email!.error).toMatch(/ECONNREFUSED|connect/i);

    // The user can see that the email failed.
    const listed = (await student.get('/api/notifications')).body.items[0];
    expect(listed.email.status).toBe('failed');
  });

  it('never exposes SMTP settings to the browser', async () => {
    const body = (await admin.get('/api/admin/settings')).body;
    expect(body.email).toEqual({ configured: false });
    expect(JSON.stringify(body)).not.toMatch(/smtp|password|pass\b/i);
  });
});
