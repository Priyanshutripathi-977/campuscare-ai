/** Duplicate suggestions through the API: detection, admin review, privacy and persistence. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app';
import { TicketModel } from '../src/models/Ticket';
import { DuplicateSuggestionModel } from '../src/models/DuplicateSuggestion';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createDepartment, createUser, loginAs } from './helpers/fixtures';

const app = createApp();
let s1: TestAgent, s2: TestAgent, admin: TestAgent, staff: TestAgent;

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
beforeEach(async () => {
  await clearDatabase();
  const elec = await createDepartment('ELEC', 'Electrical Maintenance');
  await createUser('student', 's1@x.test');
  await createUser('student', 's2@x.test');
  await createUser('admin', 'a@x.test');
  await createUser('staff', 'st@x.test', elec._id);
  [s1, s2, admin, staff] = await Promise.all([
    loginAs(app, 's1@x.test'),
    loginAs(app, 's2@x.test'),
    loginAs(app, 'a@x.test'),
    loginAs(app, 'st@x.test'),
  ]);
});

const fanA = {
  title: 'Fan not working in room 101',
  description: 'The ceiling fan in room 101 stopped working yesterday and it is very hot.',
  location: { building: 'Main Building', room: '101' },
};
const fanB = {
  title: 'Ceiling fan broken - 101',
  description: 'Fan in classroom 101 does not turn on at all since yesterday, please repair.',
  location: { building: 'Main Building', room: '101' },
};
const leak = {
  title: 'Water leaking in canteen',
  description: 'Water is leaking from the pipe under the sink in the canteen kitchen.',
  location: { building: 'Canteen' },
};
const submit = (agent: TestAgent, data: object) =>
  agent.post('/api/tickets').field('data', JSON.stringify(data));

describe('duplicate detection', () => {
  it('suggests (but does not merge) a similar open complaint', async () => {
    const first = (await submit(s1, fanA)).body.ticket;
    const second = (await submit(s2, fanB)).body.ticket;
    await submit(s2, leak);

    const list = await admin.get('/api/admin/duplicates');
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    const sug = list.body.items[0];
    expect(sug.ticket.ticketId).toBe(second.ticketId);
    expect(sug.candidate.ticketId).toBe(first.ticketId);
    expect(sug.score).toBeGreaterThanOrEqual(0.6);
    expect(sug.reasons).toContain('Same room (101)');

    // Both tickets are untouched.
    const [a, b] = await Promise.all([
      TicketModel.findById(first.id).lean(),
      TicketModel.findById(second.id).lean(),
    ]);
    expect(a!.duplicateOf).toBeNull();
    expect(b!.duplicateOf).toBeNull();
    expect(b!.status).toBe(second.status);
  });

  it('ignores resolved tickets and tickets outside the time window', async () => {
    const first = (await submit(s1, fanA)).body.ticket;
    await TicketModel.updateOne({ ticketId: first.ticketId }, { status: 'Resolved' });
    await submit(s2, fanB);
    expect((await admin.get('/api/admin/duplicates')).body.total).toBe(0);

    // Reopen the first ticket but make it 40 days old (default window is 30 days).
    // (Mongoose protects createdAt from updates, so write to the collection directly.)
    await TicketModel.collection.updateOne(
      { ticketId: first.ticketId },
      { $set: { status: 'Under Review', createdAt: new Date(Date.now() - 40 * 86_400_000) } },
    );
    await submit(s2, fanB);
    const all = (await admin.get('/api/admin/duplicates')).body.items as {
      candidate: { ticketId: string };
    }[];
    expect(all.map((x) => x.candidate.ticketId)).not.toContain(first.ticketId);
  });

  it('suggests each pair only once, newer → older, even if detection runs again on both', async () => {
    const first = (await submit(s1, fanA)).body.ticket;
    const second = (await submit(s2, fanB)).body.ticket;
    const { detectDuplicates } = await import('../src/services/duplicate.service');
    for (const id of [first.id, second.id])
      await detectDuplicates((await TicketModel.findById(id))!);
    const all = await DuplicateSuggestionModel.find().lean();
    expect(all).toHaveLength(1);
    expect(String(all[0]!.ticket)).toBe(second.id);
    expect(String(all[0]!.candidate)).toBe(first.id);
  });

  it('respects the configurable threshold', async () => {
    await admin.patch('/api/admin/settings').send({ duplicates: { threshold: 0.95 } });
    await submit(s1, fanA);
    await submit(s2, fanB);
    expect((await admin.get('/api/admin/duplicates')).body.total).toBe(0);
  });
});

describe('admin review of suggestions', () => {
  async function makePair() {
    const first = (await submit(s1, fanA)).body.ticket;
    const second = (await submit(s2, fanB)).body.ticket;
    const id = (await admin.get('/api/admin/duplicates')).body.items[0].id as string;
    return { first, second, id };
  }

  it('confirming links the tickets, informs the student, and is saved', async () => {
    const { first, second, id } = await makePair();
    const res = await admin
      .patch(`/api/admin/duplicates/${id}`)
      .send({ decision: 'confirmed', note: 'Same fan.' });
    expect(res.status).toBe(200);

    const saved = await DuplicateSuggestionModel.findById(id).lean();
    expect(saved).toMatchObject({ status: 'confirmed', note: 'Same fan.' });
    expect(saved!.reviewedBy).toBeTruthy();
    expect(saved!.reviewedAt).toBeInstanceOf(Date);

    const ticket = await TicketModel.findById(second.id).lean();
    expect(String(ticket!.duplicateOf)).toBe(first.id);
    expect(ticket!.status).not.toBe('Resolved'); // linking never closes a ticket
    expect(ticket!.updates.at(-1)!.message).toMatch(new RegExp(`duplicate of ${first.ticketId}`));

    const studentView = (await s2.get(`/api/tickets/${second.ticketId}`)).body.ticket;
    expect(studentView.duplicates).toEqual({
      duplicateOf: { ticketId: first.ticketId },
      suggestions: [],
    });
    const adminView = (await admin.get(`/api/tickets/${second.ticketId}`)).body.ticket;
    expect(adminView.duplicates.duplicateOf.title).toBe(fanA.title);
    expect(adminView.duplicates.suggestions[0]).toMatchObject({
      status: 'confirmed',
      other: { ticketId: first.ticketId },
    });
  });

  it('dismissing keeps both tickets independent', async () => {
    const { second, id } = await makePair();
    expect(
      (await admin.patch(`/api/admin/duplicates/${id}`).send({ decision: 'dismissed' })).status,
    ).toBe(200);
    expect((await TicketModel.findById(second.id).lean())!.duplicateOf).toBeNull();
    expect((await admin.get('/api/admin/duplicates?status=dismissed')).body.total).toBe(1);
    expect((await admin.get('/api/admin/duplicates')).body.total).toBe(0);
  });

  it('cannot decide the same suggestion twice', async () => {
    const { id } = await makePair();
    await admin.patch(`/api/admin/duplicates/${id}`).send({ decision: 'dismissed' });
    const again = await admin.patch(`/api/admin/duplicates/${id}`).send({ decision: 'confirmed' });
    expect(again.status).toBe(409);
  });

  it('rejects invalid input and non-admins', async () => {
    const { id } = await makePair();
    expect(
      (await admin.patch(`/api/admin/duplicates/${id}`).send({ decision: 'merge' })).status,
    ).toBe(400);
    expect(
      (await admin.patch('/api/admin/duplicates/not-an-id').send({ decision: 'dismissed' })).status,
    ).toBe(400);
    expect(
      (
        await admin
          .patch('/api/admin/duplicates/0123456789abcdef01234567')
          .send({ decision: 'dismissed' })
      ).status,
    ).toBe(404);
    expect((await admin.get('/api/admin/duplicates?status=everything')).status).toBe(400);
    for (const agent of [s1, staff]) {
      expect((await agent.get('/api/admin/duplicates')).status).toBe(403);
      expect(
        (await agent.patch(`/api/admin/duplicates/${id}`).send({ decision: 'confirmed' })).status,
      ).toBe(403);
    }
  });

  it('shows the pending count on the admin dashboard only', async () => {
    await makePair();
    expect((await admin.get('/api/admin/stats')).body.stats.pendingDuplicates).toBe(1);
    expect((await staff.get('/api/admin/stats')).body.stats.pendingDuplicates).toBeNull();
  });
});
