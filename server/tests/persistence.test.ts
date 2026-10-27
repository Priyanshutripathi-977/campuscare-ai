/**
 * Every operation is checked by reading the DATABASE directly (not just the API response),
 * including history entries, timestamps, concurrency and overdue detection.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app';
import { TicketModel } from '../src/models/Ticket';
import { CounterModel } from '../src/models/Counter';
import { DepartmentModel } from '../src/models/Department';
import { SettingsModel } from '../src/models/Settings';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createUser, loginAs, validComplaint } from './helpers/fixtures';

const app = createApp({ rateLimits: { createTicket: 10_000 } });
let student: TestAgent, admin: TestAgent, elecStaff: TestAgent, itStaff: TestAgent;
let elecId: string, itId: string, elecStaffId: string, itStaffId: string, adminId: string;

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
beforeEach(async () => {
  await clearDatabase();
  const elec = await DepartmentModel.create({
    code: 'ELEC',
    name: 'Electrical',
    categories: ['Electrical'],
  });
  const it = await DepartmentModel.create({ code: 'IT', name: 'IT Services', categories: ['IT'] });
  elecId = String(elec._id);
  itId = String(it._id);
  await createUser('student', 's@x.test');
  adminId = String((await createUser('admin', 'a@x.test'))._id);
  elecStaffId = String((await createUser('staff', 'e@x.test', elec._id))._id);
  itStaffId = String((await createUser('staff', 'i@x.test', it._id))._id);
  [student, admin, elecStaff, itStaff] = await Promise.all([
    loginAs(app, 's@x.test'),
    loginAs(app, 'a@x.test'),
    loginAs(app, 'e@x.test'),
    loginAs(app, 'i@x.test'),
  ]);
});

const db = (ticketId: string) => TicketModel.findOne({ ticketId }).lean();
const create = async () =>
  (await student.post('/api/tickets').field('data', JSON.stringify(validComplaint))).body.ticket
    .ticketId as string;
async function assigned() {
  const id = await create();
  await admin
    .patch(`/api/tickets/${id}/classification`)
    .send({ category: 'Electrical', priority: 'High' });
  await admin
    .patch(`/api/tickets/${id}/assign`)
    .send({ departmentId: elecId, assignedTo: elecStaffId });
  return id;
}

describe('ticket creation and IDs', () => {
  it('stores the complaint, its history and the counter', async () => {
    const id = await create();
    const t = await db(id);
    expect(t).toMatchObject({
      title: validComplaint.title,
      location: { building: 'Main Building', room: '101' },
    });
    expect(t!.statusHistory[0]).toMatchObject({ from: null, to: 'Submitted' });
    expect(t!.statusHistory[0]!.at).toBeInstanceOf(Date);
    const counter = await CounterModel.findById(`ticket-${new Date().getFullYear()}`).lean();
    expect(counter!.seq).toBe(1);
  });

  it('gives unique IDs to 20 simultaneous submissions', async () => {
    const ids = await Promise.all(Array.from({ length: 20 }, create));
    expect(new Set(ids).size).toBe(20);
    expect(await TicketModel.countDocuments()).toBe(20);
  });
});

describe('status history', () => {
  it('records every change with who, when and note', async () => {
    const id = await assigned();
    await elecStaff
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'In Progress', note: 'On it' });
    await elecStaff
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'Resolved', confirm: true, note: 'Replaced the capacitor' });
    await student.post(`/api/tickets/${id}/reopen`).send({ reason: 'It stopped again' });

    const t = await db(id);
    expect(t!.status).toBe('Reopened');
    expect(t!.resolvedAt).toBeNull();
    const tail = t!.statusHistory.slice(-4).map((h) => [h.from, h.to, h.note]);
    expect(tail).toEqual([
      ['Under Review', 'Assigned', 'Assigned to Electrical'],
      ['Assigned', 'In Progress', 'On it'],
      ['In Progress', 'Resolved', 'Replaced the capacitor'],
      ['Resolved', 'Reopened', 'It stopped again'],
    ]);
    expect(String(t!.statusHistory.at(-2)!.by)).toBe(elecStaffId);
    const times = t!.statusHistory.map((h) => h.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times); // chronological
  });

  it('two people changing status at the same moment: one wins, one gets 409, history stays consistent', async () => {
    const id = await assigned();
    const [a, b] = await Promise.all([
      elecStaff.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' }),
      admin.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const t = await db(id);
    expect(t!.statusHistory.filter((h) => h.to === 'In Progress')).toHaveLength(1);
  });
});

describe('routing and manual reassignment', () => {
  it('stores the routing decision with who and when', async () => {
    const id = await assigned();
    const t = await db(id);
    expect(String(t!.department)).toBe(elecId);
    expect(String(t!.assignedTo)).toBe(elecStaffId);
    expect(t!.routing).toMatchObject({ method: 'manual' });
    expect(String(t!.routing!.decidedBy)).toBe(adminId);
    expect(t!.routing!.decidedAt).toBeInstanceOf(Date);
    expect(t!.needsReview).toBe(false);
  });

  it('reassigning moves access to the new department and keeps the status', async () => {
    const id = await assigned();
    await elecStaff.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    const res = await admin
      .patch(`/api/tickets/${id}/assign`)
      .send({ departmentId: itId, assignedTo: itStaffId, note: 'It is a network switch' });
    expect(res.status).toBe(200);

    const t = await db(id);
    expect(t).toMatchObject({ status: 'In Progress' });
    expect(String(t!.department)).toBe(itId);
    expect(String(t!.assignedTo)).toBe(itStaffId);
    expect(t!.routing!.reason).toBe('It is a network switch');
    expect(t!.statusHistory.at(-1)!.note).toMatch(
      /^Reassigned to IT Services — It is a network switch/,
    );

    expect((await elecStaff.get(`/api/tickets/${id}`)).status).toBe(404); // old department lost access
    expect((await itStaff.get(`/api/tickets/${id}`)).status).toBe(200); // new department gained it
  });

  it('a resolved ticket cannot be reassigned', async () => {
    const id = await assigned();
    await TicketModel.updateOne({ ticketId: id }, { status: 'Resolved' });
    expect(
      (await admin.patch(`/api/tickets/${id}/assign`).send({ departmentId: itId })).status,
    ).toBe(409);
    expect(String((await db(id))!.department)).toBe(elecId);
  });
});

describe('overdue detection', () => {
  it('derives "overdue" from the stored deadline, excluding resolved tickets', async () => {
    const late = await assigned();
    const lateButDone = await assigned();
    const onTime = await assigned();
    const past = new Date(Date.now() - 3600_000);
    await TicketModel.updateMany({ ticketId: { $in: [late, lateButDone] } }, { dueAt: past });
    await TicketModel.updateOne({ ticketId: lateButDone }, { status: 'Resolved' });

    const list = (await admin.get('/api/tickets?overdue=true')).body;
    expect(list.items.map((t: { ticketId: string }) => t.ticketId)).toEqual([late]);
    expect((await admin.get(`/api/tickets/${onTime}`)).body.ticket.overdue).toBe(false);
    expect((await admin.get('/api/admin/stats')).body.stats.overdue).toBe(1);
  });

  it('the deadline comes from the SLA settings and is stored on the ticket', async () => {
    await admin.patch('/api/admin/settings').send({ slaHours: { High: 10 } });
    expect((await SettingsModel.findOne({ key: 'global' }).lean())!.slaHours!.High).toBe(10);
    const id = await assigned();
    const t = await db(id);
    expect((t!.dueAt!.getTime() - t!.createdAt.getTime()) / 3600_000).toBeCloseTo(10, 5);
  });
});

describe('other persisted operations', () => {
  it('updates, classification and department map are saved', async () => {
    const id = await create();
    await student
      .post(`/api/tickets/${id}/updates`)
      .send({ message: 'Photo: it is the second fan.' });
    await admin
      .patch(`/api/tickets/${id}/classification`)
      .send({ category: 'IT', priority: 'Low' });
    await admin.patch(`/api/admin/departments/${itId}`).send({ categories: ['IT', 'Other'] });

    const t = await db(id);
    expect(t!.updates.at(-1)).toMatchObject({
      message: 'Photo: it is the second fan.',
      authorRole: 'student',
    });
    expect(t).toMatchObject({
      category: 'IT',
      priority: 'Low',
      priorityRank: 1,
      classification: { source: 'admin' },
    });
    expect((await DepartmentModel.findById(itId).lean())!.categories).toEqual(['IT', 'Other']);
  });
});

describe('simultaneous updates (regression: audit B2)', () => {
  it('two admins assigning at the same moment: one wins, the other gets 409, history stays consistent', async () => {
    const admin2 = await (async () => {
      await createUser('admin', 'a2@x.test');
      return loginAs(app, 'a2@x.test');
    })();
    for (let i = 0; i < 10; i++) {
      const id = await create();
      await admin
        .patch(`/api/tickets/${id}/classification`)
        .send({ category: 'Electrical', priority: 'High' });
      const [r1, r2] = await Promise.all([
        admin.patch(`/api/tickets/${id}/assign`).send({ departmentId: elecId }),
        admin2.patch(`/api/tickets/${id}/assign`).send({ departmentId: itId }),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      const t = await db(id);
      const assigned = t!.statusHistory.filter((h) => h.to === 'Assigned');
      expect(assigned).toHaveLength(1);
      const winner = r1.status === 200 ? elecId : itId;
      expect(String(t!.department)).toBe(winner);
    }
  });

  it('staff starting work while an admin reassigns: never a false 404, history matches reality', async () => {
    for (let i = 0; i < 10; i++) {
      const id = await assigned(); // assigned to Electrical, assignee elecStaff
      const [work, move] = await Promise.all([
        elecStaff.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' }),
        admin.patch(`/api/tickets/${id}/assign`).send({ departmentId: itId, note: 'Moving to IT' }),
      ]);
      expect([work.status, move.status].sort()).toEqual([200, 409]);
      const t = await db(id);
      if (work.status === 200) {
        expect(t).toMatchObject({ status: 'In Progress' });
        expect(String(t!.department)).toBe(elecId);
      } else {
        expect(t).toMatchObject({ status: 'Assigned' });
        expect(String(t!.department)).toBe(itId);
      }
      // Each history entry starts from the status the previous entry ended in.
      t!.statusHistory.slice(1).forEach((h, k) => expect(h.from).toBe(t!.statusHistory[k]!.to));
    }
  });
});
