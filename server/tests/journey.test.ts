/**
 * End-to-end journeys through the real HTTP API, the real Gemini SDK (pointed at a local
 * fake Gemini server) and a real (in-memory) MongoDB. Each step is checked both in the
 * API response and directly in the database.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app';
import { TicketModel } from '../src/models/Ticket';
import { NotificationModel } from '../src/models/Notification';
import { DepartmentModel } from '../src/models/Department';
import { setAiProvider } from '../src/services/ai/provider';
import { createGeminiProvider } from '../src/services/ai/geminiProvider';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createUser, loginAs, PNG_1PX } from './helpers/fixtures';
import { goodAnswer } from './helpers/fakeAi';
import { startFakeGemini } from './helpers/fakeGeminiServer';

const app = createApp();
let gemini: Awaited<ReturnType<typeof startFakeGemini>>;
let student: TestAgent, admin: TestAgent, elecStaff: TestAgent, itStaff: TestAgent;
let elecId: string, itStaffId: string, itId: string;

beforeAll(async () => {
  await startTestDatabase();
  gemini = await startFakeGemini();
});
afterAll(async () => {
  await gemini.close();
  await stopTestDatabase();
});
afterEach(() => setAiProvider(undefined));
beforeEach(async () => {
  await clearDatabase();
  gemini.requests.length = 0;
  const elec = await DepartmentModel.create({
    code: 'ELEC',
    name: 'Electrical Maintenance',
    categories: ['Electrical'],
  });
  const it = await DepartmentModel.create({ code: 'IT', name: 'IT Services', categories: ['IT'] });
  await DepartmentModel.create({
    code: 'ADMN',
    name: 'General Administration',
    categories: ['Other'],
  });
  elecId = String(elec._id);
  itId = String(it._id);
  await createUser('student', 'student@x.test');
  await createUser('admin', 'admin@x.test');
  await createUser('staff', 'elec@x.test', elec._id);
  itStaffId = String((await createUser('staff', 'it@x.test', it._id))._id);
  [student, admin, elecStaff, itStaff] = await Promise.all([
    loginAs(app, 'student@x.test'),
    loginAs(app, 'admin@x.test'),
    loginAs(app, 'elec@x.test'),
    loginAs(app, 'it@x.test'),
  ]);
  setAiProvider(
    createGeminiProvider({ apiKey: 'fake-key', model: 'gemini-fake', baseUrl: gemini.baseUrl }),
  );
});

const db = (ticketId: string) => TicketModel.findOne({ ticketId }).lean();
const inbox = async (agent: TestAgent) =>
  (await agent.get('/api/notifications')).body as {
    unreadCount: number;
    items: { message: string }[];
  };

describe('Journey A: confident AI → automatic routing → staff fixes it → student tracks it', () => {
  it('works end to end and every step is persisted', async () => {
    gemini.onRequest(() =>
      gemini.ok(goodAnswer({ category: 'Electrical', priority: 'High', confidence: 0.93 })),
    );

    // 1. Student submits with a photo.
    const submit = await student
      .post('/api/tickets')
      .field(
        'data',
        JSON.stringify({
          title: 'Fan not working in room 101',
          description: 'The ceiling fan in room 101 stopped working yesterday and it is very hot.',
          location: { building: 'Main Building', room: '101' },
        }),
      )
      .attach('image', PNG_1PX, 'fan.png');
    expect(submit.status).toBe(201);
    const t = submit.body.ticket;
    expect(t.ticketId).toMatch(/^CC-\d{4}-\d{6}$/);

    // 2. The real SDK called the (fake) Gemini once, with the complaint in the prompt.
    expect(gemini.requests).toHaveLength(1);
    expect(gemini.requests[0]!.url).toMatch(/gemini-fake:generateContent/);

    // 3. Routed automatically to Electrical, persisted with the AI analysis and routing decision.
    expect(t).toMatchObject({
      status: 'Assigned',
      category: 'Electrical',
      priority: 'High',
      department: { name: 'Electrical Maintenance' },
    });
    let saved = await db(t.ticketId);
    expect(saved!.ai).toMatchObject({
      source: 'gemini',
      model: 'gemini-fake',
      valid: true,
      confidence: 0.93,
    });
    expect(saved!.routing).toMatchObject({ method: 'auto' });
    expect(saved!.routing!.decidedAt).toBeInstanceOf(Date);
    expect(saved!.image?.mimeType).toBe('image/png');
    expect(saved!.dueAt).toBeInstanceOf(Date);

    // 4. Electrical staff were told; IT staff were not and can't see it.
    expect((await inbox(elecStaff)).unreadCount).toBe(1);
    expect((await inbox(itStaff)).unreadCount).toBe(0);
    expect((await itStaff.get(`/api/tickets/${t.ticketId}`)).status).toBe(404);

    // 5. Staff works on it and resolves it (confirmation + note required).
    expect(
      (await elecStaff.patch(`/api/tickets/${t.ticketId}/status`).send({ status: 'In Progress' }))
        .status,
    ).toBe(200);
    await elecStaff
      .post(`/api/tickets/${t.ticketId}/updates`)
      .send({ message: 'Technician will come at 3 pm.' });
    expect(
      (
        await elecStaff
          .patch(`/api/tickets/${t.ticketId}/status`)
          .send({ status: 'Resolved', note: 'Replaced the capacitor' })
      ).status,
    ).toBe(400);
    expect(
      (
        await elecStaff
          .patch(`/api/tickets/${t.ticketId}/status`)
          .send({ status: 'Resolved', note: 'Replaced the capacitor', confirm: true })
      ).status,
    ).toBe(200);

    // 6. The student tracks everything: list, detail, history, conversation, photo, notifications.
    const list = (await student.get('/api/tickets')).body;
    expect(list.items[0]).toMatchObject({ ticketId: t.ticketId, status: 'Resolved' });
    const detail = (await student.get(`/api/tickets/${t.ticketId}`)).body.ticket;
    expect(detail.statusHistory.map((h: { to: string }) => h.to)).toEqual([
      'Submitted',
      'Assigned',
      'In Progress',
      'Resolved',
    ]);
    expect(detail.updates.map((u: { message: string }) => u.message)).toEqual([
      'Technician will come at 3 pm.',
    ]);
    // Students see the summary and suggestion, but not internal details like confidence.
    expect(detail.ai).toMatchObject({ view: 'student', source: 'gemini', category: 'Electrical' });
    expect(detail.ai).not.toHaveProperty('confidence');
    expect((await student.get(`/api/tickets/${t.ticketId}/image`)).status).toBe(200);
    const notes = await inbox(student);
    expect(notes.items.map((n) => n.message)).toEqual([
      'Your complaint was marked as resolved: Replaced the capacitor. If it is not fixed, you can reopen it.',
      'staff elec@x.test replied: “Technician will come at 3 pm.”',
      'Work has started on your complaint.',
    ]);

    saved = await db(t.ticketId);
    expect(saved!.status).toBe('Resolved');
    expect(saved!.resolvedAt).toBeInstanceOf(Date);
  });
});

describe('Journey B: Critical complaint → admin review → manual assignment → reassignment → reopen', () => {
  it('keeps a human in the loop and records every decision', async () => {
    gemini.onRequest(() =>
      gemini.ok(
        goodAnswer({
          category: 'Electrical',
          priority: 'Critical',
          confidence: 0.97,
          safetyRisk: true,
        }),
      ),
    );

    const t = (
      await student.post('/api/tickets').field(
        'data',
        JSON.stringify({
          title: 'Exposed live wire on staircase',
          description:
            'There is an exposed live wire hanging from the switchboard on the staircase landing.',
          location: { building: 'Admin Block' },
        }),
      )
    ).body.ticket;

    // Critical → never auto-routed, even at 97% confidence.
    expect(t).toMatchObject({ status: 'Under Review', department: null, priority: 'Critical' });
    const queue = (await admin.get('/api/tickets?needsReview=true')).body;
    expect(queue.items.map((x: { ticketId: string }) => x.ticketId)).toContain(t.ticketId);
    const adminView = (await admin.get(`/api/tickets/${t.ticketId}`)).body.ticket;
    expect(adminView.reviewReasons).toEqual(['critical_priority']);
    expect(adminView.ai).toMatchObject({
      safetyRisk: true,
      recommendedDepartment: { name: 'Electrical Maintenance' },
    });

    // Admin confirms and assigns.
    await admin
      .patch(`/api/tickets/${t.ticketId}/classification`)
      .send({ category: 'Electrical', priority: 'Critical' });
    expect(
      (
        await admin
          .patch(`/api/tickets/${t.ticketId}/assign`)
          .send({ departmentId: elecId, note: 'Urgent safety issue' })
      ).status,
    ).toBe(200);

    // Wrong department after all → reassign to IT with a specific person.
    expect(
      (
        await admin.patch(`/api/tickets/${t.ticketId}/assign`).send({
          departmentId: itId,
          assignedTo: itStaffId,
          note: 'It is a network cable, not mains',
        })
      ).status,
    ).toBe(200);
    expect((await elecStaff.get(`/api/tickets/${t.ticketId}`)).status).toBe(404);
    await itStaff.patch(`/api/tickets/${t.ticketId}/status`).send({ status: 'In Progress' });
    await itStaff
      .patch(`/api/tickets/${t.ticketId}/status`)
      .send({ status: 'Resolved', confirm: true, note: 'Cable secured in conduit' });

    // Student reopens.
    expect(
      (
        await student
          .post(`/api/tickets/${t.ticketId}/reopen`)
          .send({ reason: 'The cable is hanging again' })
      ).status,
    ).toBe(200);

    const saved = await db(t.ticketId);
    expect(saved!.status).toBe('Reopened');
    expect(String(saved!.department)).toBe(itId);
    expect(saved!.routing).toMatchObject({
      method: 'manual',
      reason: 'It is a network cable, not mains',
    });
    expect(saved!.statusHistory.map((h) => h.to)).toEqual([
      'Submitted',
      'Under Review',
      'Assigned',
      'Assigned',
      'In Progress',
      'Resolved',
      'Reopened',
    ]);
    expect(saved!.classification).toMatchObject({ source: 'admin' });

    // The IT person was told about the reopen.
    const reopenNotes = await NotificationModel.find({ type: 'ticket_reopened' }).lean();
    expect(reopenNotes.map((n) => String(n.user))).toEqual([itStaffId]);
  });
});

describe('Journey C: Gemini down → keyword fallback → admin review (complaint never lost)', () => {
  it('stores the complaint and the reason Gemini failed', async () => {
    gemini.onRequest(() => ({
      status: 503,
      body: { error: { code: 503, message: 'overloaded', status: 'UNAVAILABLE' } },
    }));
    const res = await student.post('/api/tickets').field(
      'data',
      JSON.stringify({
        title: 'Water leaking from ceiling',
        description:
          'Water is dripping from the ceiling outside room 204 whenever the tank is filled.',
        location: { building: 'Engineering Block A', room: '204' },
      }),
    );
    expect(res.status).toBe(201);
    const saved = await db(res.body.ticket.ticketId);
    expect(saved).toMatchObject({
      status: 'Under Review',
      needsReview: true,
      category: 'Plumbing',
    });
    expect(saved!.ai).toMatchObject({
      source: 'fallback_rules',
      valid: false,
      error: 'provider_unavailable',
    });
    expect(saved!.reviewReasons).toContain('ai_unavailable');
  });
});
