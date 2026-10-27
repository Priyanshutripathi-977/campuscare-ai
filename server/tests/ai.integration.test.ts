/** End-to-end: complaint submission → AI analysis → routing decision, through the real API. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app';
import { setAiProvider } from '../src/services/ai/provider';
import { DepartmentModel } from '../src/models/Department';
import { TicketModel } from '../src/models/Ticket';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createUser, loginAs, validComplaint } from './helpers/fixtures';
import { failingProvider, fakeProvider, goodAnswer } from './helpers/fakeAi';

const app = createApp();
let student: TestAgent, otherStudent: TestAgent, admin: TestAgent;
let elecId: string, adminDeptId: string;

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
afterEach(() => setAiProvider(undefined));

beforeEach(async () => {
  await clearDatabase();
  elecId = String(
    (
      await DepartmentModel.create({
        code: 'ELEC',
        name: 'Electrical Maintenance',
        categories: ['Electrical'],
      })
    )._id,
  );
  await DepartmentModel.create({ code: 'IT', name: 'IT Services', categories: ['IT'] });
  adminDeptId = String(
    (
      await DepartmentModel.create({
        code: 'ADMN',
        name: 'General Administration',
        categories: ['Other'],
      })
    )._id,
  );
  await createUser('student', 's@x.test');
  await createUser('student', 'o@x.test');
  await createUser('admin', 'a@x.test');
  [student, otherStudent, admin] = await Promise.all([
    loginAs(app, 's@x.test'),
    loginAs(app, 'o@x.test'),
    loginAs(app, 'a@x.test'),
  ]);
});

const submit = (data: object = validComplaint) =>
  student.post('/api/tickets').field('data', JSON.stringify(data));
const useAnswer = (o = {}) => fakeProvider(JSON.stringify(goodAnswer(o)));

describe('AI routing on submission', () => {
  it('auto-routes a confident classification to the mapped department', async () => {
    setAiProvider(useAnswer().provider);
    const { body, status } = await submit();
    expect(status).toBe(201);
    const t = body.ticket;
    expect(t).toMatchObject({
      status: 'Assigned',
      category: 'Electrical',
      priority: 'High',
      needsReview: false,
    });
    expect(t.department).toMatchObject({ id: elecId, name: 'Electrical Maintenance' });
    expect(t.statusHistory.map((h: { to: string }) => h.to)).toEqual(['Submitted', 'Assigned']);
    expect(t.dueAt).toBeTruthy();

    // Staff/admin see the full analysis and the routing explanation…
    const adminView = (await admin.get(`/api/tickets/${t.ticketId}`)).body.ticket;
    expect(adminView.routing).toMatchObject({ method: 'auto' });
    expect(adminView.routing.reason).toMatch(/Automatically routed to Electrical Maintenance/);
    expect(adminView.ai).toMatchObject({
      source: 'gemini',
      confidence: 0.92,
      recommendedDepartment: { name: 'Electrical Maintenance' },
    });
    // …students do not.
    // …students get only a plain summary + suggestion for their own complaint.
    expect(t.ai).toEqual({
      view: 'student',
      source: 'gemini',
      summary: 'Ceiling fan in room 101 is not working.',
      category: 'Electrical',
      priority: 'High',
      recommendedDepartment: { id: elecId, name: 'Electrical Maintenance' },
      needsClarification: false,
      clarificationQuestion: null,
    });
    for (const internal of [
      'confidence',
      'categoryReason',
      'priorityReason',
      'error',
      'valid',
      'model',
      'keyDetails',
    ]) {
      expect(t.ai).not.toHaveProperty(internal);
    }
    expect(t.routing).toBeNull();
  });

  it('keeps Critical tickets for a human even when the AI is confident', async () => {
    setAiProvider(useAnswer({ priority: 'Critical', safetyRisk: true }).provider);
    const t = (await submit()).body.ticket;
    expect(t).toMatchObject({ status: 'Under Review', department: null, priority: 'Critical' });
    const adminView = (await admin.get(`/api/tickets/${t.ticketId}`)).body.ticket;
    expect(adminView.reviewReasons).toEqual(['critical_priority']);
    expect(adminView.ai.recommendedDepartment.name).toBe('Electrical Maintenance'); // suggestion only
  });

  it('sends low-confidence results to review', async () => {
    setAiProvider(useAnswer({ confidence: 0.4 }).provider);
    const t = (await submit()).body.ticket;
    expect(t.status).toBe('Under Review');
    expect((await admin.get(`/api/tickets/${t.ticketId}`)).body.ticket.reviewReasons).toEqual([
      'low_confidence',
    ]);
  });

  it('still creates the ticket when the AI API fails, and records why', async () => {
    setAiProvider(failingProvider(503));
    const res = await submit();
    expect(res.status).toBe(201);
    const adminView = (await admin.get(`/api/tickets/${res.body.ticket.ticketId}`)).body.ticket;
    expect(adminView).toMatchObject({ status: 'Under Review', needsReview: true });
    expect(adminView.ai).toMatchObject({
      source: 'fallback_rules',
      valid: false,
      error: 'provider_unavailable',
    });
    expect(adminView.reviewReasons).toContain('ai_unavailable');
  });

  it('never acts on a model answer that fails validation', async () => {
    // A "malicious" answer: invalid category and fields that try to take actions.
    setAiProvider(
      fakeProvider(
        JSON.stringify({ ...goodAnswer(), category: 'Admin', status: 'Resolved', confidence: 1 }),
      ).provider,
    );
    const t = (await submit()).body.ticket;
    expect(t.status).toBe('Under Review');
    const adminView = (await admin.get(`/api/tickets/${t.ticketId}`)).body.ticket;
    expect(adminView.ai).toMatchObject({ source: 'fallback_rules', valid: false });
    expect(adminView.ai.error).toMatch(/schema_validation_failed: category/);
  });

  it('routes "Other" to review by default', async () => {
    setAiProvider(useAnswer({ category: 'Other' }).provider);
    const adminView = (await admin.get(`/api/tickets/${(await submit()).body.ticket.ticketId}`))
      .body.ticket;
    expect(adminView.reviewReasons).toEqual(['review_category']);
  });
});

describe('clarification flow', () => {
  it('asks the student a question, then re-analyses when they answer', async () => {
    const { provider, calls } = fakeProvider((input) =>
      JSON.stringify(
        input.followUps?.length
          ? goodAnswer()
          : goodAnswer({
              confidence: 0.3,
              needsClarification: true,
              clarificationQuestion: 'Which room is the fan in?',
            }),
      ),
    );
    setAiProvider(provider);
    const t = (await submit()).body.ticket;
    expect(t.status).toBe('Under Review');
    expect(t.ai).toMatchObject({
      view: 'student',
      needsClarification: true,
      clarificationQuestion: 'Which room is the fan in?',
    });

    // Another student's reply can't trigger anything (they can't even see the ticket).
    expect(
      (await otherStudent.post(`/api/tickets/${t.ticketId}/updates`).send({ message: 'Room 101' }))
        .status,
    ).toBe(404);

    const answered = (
      await student
        .post(`/api/tickets/${t.ticketId}/updates`)
        .send({ message: 'It is in room 101, second fan from the door.' })
    ).body.ticket;
    expect(calls).toHaveLength(2);
    expect(calls[1]!.followUps).toEqual(['It is in room 101, second fan from the door.']);
    expect(answered.status).toBe('Assigned');
    expect(answered.ai).toMatchObject({ needsClarification: false, clarificationQuestion: null }); // the question is gone
    expect(answered.statusHistory.at(-1).note).toMatch(/after student added details/);
  });
});

describe('clarification after an admin decision (regression: audit B1)', () => {
  it("a student's answer never overwrites the admin's category/priority or routes the ticket", async () => {
    // The AI asks for clarification and, after the answer, would suggest IT / Low at high confidence.
    const { provider, calls } = fakeProvider((input) =>
      JSON.stringify(
        input.followUps?.length
          ? goodAnswer({ category: 'IT', priority: 'Low', confidence: 0.95 })
          : goodAnswer({
              confidence: 0.3,
              needsClarification: true,
              clarificationQuestion: 'Where exactly?',
            }),
      ),
    );
    setAiProvider(provider);
    const t = (await submit()).body.ticket;

    // The admin decides before the student answers: Electrical / Critical.
    await admin
      .patch(`/api/tickets/${t.ticketId}/classification`)
      .send({ category: 'Electrical', priority: 'Critical' });
    const before = await TicketModel.findOne({ ticketId: t.ticketId }).lean();

    await student
      .post(`/api/tickets/${t.ticketId}/updates`)
      .send({ message: 'It is room 101, the fan sparks.' });
    const after = await TicketModel.findOne({ ticketId: t.ticketId }).lean();

    expect(calls).toHaveLength(2); // the answer WAS analysed…
    expect(after).toMatchObject({
      category: 'Electrical',
      priority: 'Critical',
      status: 'Under Review',
      department: null,
    }); // …but nothing the admin decided changed
    expect(after!.classification!.source).toBe('admin');
    expect(after!.dueAt!.getTime()).toBe(before!.dueAt!.getTime());
    expect(after!.ai).toMatchObject({ category: 'IT', needsClarification: false }); // fresh analysis kept as a note
    expect(after!.reviewReasons).not.toContain('needs_clarification');
  });
});

describe('admin controls', () => {
  it('lets an admin re-run the analysis for tickets under review only', async () => {
    setAiProvider(failingProvider(500));
    const t = (await submit()).body.ticket;
    setAiProvider(useAnswer().provider); // e.g. the API is back
    const rerun = await admin.post(`/api/tickets/${t.ticketId}/reanalyze`);
    expect(rerun.status).toBe(200);
    expect(rerun.body.ticket).toMatchObject({ status: 'Assigned', routing: { method: 'auto' } });
    expect((await admin.post(`/api/tickets/${t.ticketId}/reanalyze`)).status).toBe(409); // already assigned
    expect((await student.post(`/api/tickets/${t.ticketId}/reanalyze`)).status).toBe(403);
  });

  it('routing rules are configurable through the settings API', async () => {
    const before = (await admin.get('/api/admin/settings')).body;
    expect(before.settings.routing).toEqual({
      autoRouteConfidence: 0.75,
      reviewCriticalPriority: true,
      reviewCategories: ['Other'],
    });
    expect(JSON.stringify(before)).not.toMatch(/apiKey|GEMINI_API_KEY|secret/i);

    const patch = await admin
      .patch('/api/admin/settings')
      .send({ routing: { reviewCriticalPriority: false }, slaHours: { Critical: 2 } });
    expect(patch.status).toBe(200);
    expect(patch.body.settings).toMatchObject({
      routing: { reviewCriticalPriority: false },
      slaHours: { Critical: 2, High: 24 },
    });

    setAiProvider(useAnswer({ priority: 'Critical' }).provider);
    const t = (await submit()).body.ticket;
    expect(t.status).toBe('Assigned'); // Critical now auto-routes under the new rule
    const hours = (new Date(t.dueAt).getTime() - new Date(t.createdAt).getTime()) / 3600_000;
    expect(hours).toBeCloseTo(2, 1);
  });

  it('validates settings input', async () => {
    expect(
      (await admin.patch('/api/admin/settings').send({ routing: { autoRouteConfidence: 0.1 } }))
        .status,
    ).toBe(400);
    expect(
      (await admin.patch('/api/admin/settings').send({ routing: { reviewCategories: ['Banana'] } }))
        .status,
    ).toBe(400);
    expect((await admin.patch('/api/admin/settings').send({ hack: true })).status).toBe(400);
    expect((await student.patch('/api/admin/settings').send({ slaHours: { Low: 1 } })).status).toBe(
      403,
    );
  });

  it('lets admins edit the category → department map, without overlaps', async () => {
    const clash = await admin
      .patch(`/api/admin/departments/${adminDeptId}`)
      .send({ categories: ['Other', 'Electrical'] });
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toMatch(
      /Electrical is already handled by Electrical Maintenance/,
    );

    expect(
      (await admin.patch(`/api/admin/departments/${elecId}`).send({ categories: [] })).status,
    ).toBe(200);
    expect(
      (
        await admin
          .patch(`/api/admin/departments/${adminDeptId}`)
          .send({ categories: ['Other', 'Electrical'] })
      ).status,
    ).toBe(200);

    setAiProvider(useAnswer().provider);
    const t = (await submit()).body.ticket;
    expect(t.department.name).toBe('General Administration'); // routing follows the new map
  });
});
