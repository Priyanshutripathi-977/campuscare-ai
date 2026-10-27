/** Invalid input is rejected with a clear 4xx error — never a crash (500) and never saved. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app';
import { TicketModel } from '../src/models/Ticket';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import {
  clearDatabase,
  createDepartment,
  createUser,
  loginAs,
  PNG_1PX,
  validComplaint,
} from './helpers/fixtures';

const app = createApp({ rateLimits: { createTicket: 10_000 } });
let student: TestAgent, admin: TestAgent, staff: TestAgent, ticketId: string, elecId: string;

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
beforeEach(async () => {
  await clearDatabase();
  const elec = await createDepartment();
  elecId = String(elec._id);
  await createUser('student', 's@x.test');
  await createUser('admin', 'a@x.test');
  await createUser('staff', 'st@x.test', elec._id);
  [student, admin, staff] = await Promise.all([
    loginAs(app, 's@x.test'),
    loginAs(app, 'a@x.test'),
    loginAs(app, 'st@x.test'),
  ]);
  ticketId = (await student.post('/api/tickets').field('data', JSON.stringify(validComplaint))).body
    .ticket.ticketId;
});

const create = (data: unknown) =>
  student
    .post('/api/tickets')
    .field('data', typeof data === 'string' ? data : JSON.stringify(data));
const ticketCount = () => TicketModel.countDocuments();

describe('creating a ticket', () => {
  it.each<[string, unknown]>([
    ['data is not JSON', '{not json'],
    ['data is a JSON array', '[1,2]'],
    ['title too short', { ...validComplaint, title: 'abc' }],
    ['title too long', { ...validComplaint, title: 'x'.repeat(121) }],
    ['description too short', { ...validComplaint, description: 'too short' }],
    ['description too long', { ...validComplaint, description: 'x'.repeat(2001) }],
    ['building missing', { ...validComplaint, location: { room: '1' } }],
    ['location not an object', { ...validComplaint, location: 'Main Building' }],
    ['unknown category', { ...validComplaint, category: 'Plumbing & Gas' }],
    ['title is a number', { ...validComplaint, title: 12345 }],
    ['NoSQL operator instead of text', { ...validComplaint, title: { $gt: '' } }],
  ])('rejects: %s', async (_label, data) => {
    const before = await ticketCount();
    const res = await create(data);
    expect(res.status).toBe(400);
    expect(await ticketCount()).toBe(before); // nothing saved
  });

  it('rejects a request without the data field', async () => {
    expect((await student.post('/api/tickets').field('other', 'x')).status).toBe(400);
  });

  it('rejects more than one file, or a file in the wrong field', async () => {
    const two = await student
      .post('/api/tickets')
      .field('data', JSON.stringify(validComplaint))
      .attach('image', PNG_1PX, 'a.png')
      .attach('image', PNG_1PX, 'b.png');
    expect(two.status).toBe(400);
    const wrongField = await student
      .post('/api/tickets')
      .field('data', JSON.stringify(validComplaint))
      .attach('photo', PNG_1PX, 'a.png');
    expect(wrongField.status).toBe(400);
  });
});

describe('ticket actions', () => {
  it.each([
    ['malformed ticket id', '/api/tickets/../../etc/passwd', 404],
    ['wrong id format', '/api/tickets/CC-26-1', 400],
    ['valid format, no such ticket', '/api/tickets/CC-2026-999999', 404],
  ])('GET %s', async (_l, url, code) => {
    expect((await admin.get(url)).status).toBe(code);
  });

  it.each<[string, object]>([
    ['empty message', { message: '' }],
    ['whitespace-only message', { message: '    ' }],
    ['too long', { message: 'x'.repeat(1001) }],
    ['not a string', { message: ['a', 'b'] }],
    ['operator object', { message: { $ne: null } }],
  ])('rejects update: %s', async (_l, body) => {
    expect((await student.post(`/api/tickets/${ticketId}/updates`).send(body)).status).toBe(400);
  });

  it.each<[string, object]>([
    ['unknown status', { status: 'Done' }],
    ['status missing', {}],
    ['resolve without confirm', { status: 'Resolved', note: 'Fixed it now' }],
    [
      'resolve with confirm "true" as a string',
      { status: 'Resolved', note: 'Fixed it now', confirm: 'true' },
    ],
    ['resolve without a note', { status: 'Resolved', confirm: true }],
    ['note too long', { status: 'In Progress', note: 'x'.repeat(501) }],
  ])('rejects status change: %s', async (_l, body) => {
    await TicketModel.updateOne({ ticketId }, { status: 'In Progress', department: elecId });
    const res = await admin.patch(`/api/tickets/${ticketId}/status`).send(body);
    expect(res.status).toBe(400);
    expect((await TicketModel.findOne({ ticketId }).lean())!.status).toBe('In Progress');
  });

  it.each<[string, object, number]>([
    ['invalid department id', { departmentId: 'abc' }, 400],
    ['unknown department', { departmentId: '0123456789abcdef01234567' }, 400],
    [
      'assignee is not staff of that department',
      { departmentId: '__elec__', assignedTo: '0123456789abcdef01234567' },
      400,
    ],
  ])('rejects assignment: %s', async (_l, body, code) => {
    const payload = JSON.parse(JSON.stringify(body).replace('__elec__', elecId));
    expect((await admin.patch(`/api/tickets/${ticketId}/assign`).send(payload)).status).toBe(code);
  });

  it('rejects an invalid classification', async () => {
    expect(
      (
        await admin
          .patch(`/api/tickets/${ticketId}/classification`)
          .send({ category: 'IT', priority: 'Urgent' })
      ).status,
    ).toBe(400);
    expect(
      (
        await admin
          .patch(`/api/tickets/${ticketId}/classification`)
          .send({ category: 'Food', priority: 'Low' })
      ).status,
    ).toBe(400);
  });

  it('rejects reopening without a reason, or a ticket that is not resolved', async () => {
    expect(
      (await student.post(`/api/tickets/${ticketId}/reopen`).send({ reason: 'no' })).status,
    ).toBe(400);
    expect(
      (await student.post(`/api/tickets/${ticketId}/reopen`).send({ reason: 'Still broken today' }))
        .status,
    ).toBe(409);
  });
});

describe('list and admin endpoints', () => {
  it.each([
    'limit=500',
    'limit=0',
    'page=0',
    'page=99999999',
    'sort=random',
    'status=Done',
    'status=Assigned&status=Resolved', // repeated parameter (array) is not accepted
    'overdue=yes',
    `q=${'x'.repeat(101)}`,
    'department=not-an-id',
  ])('rejects ?%s', async (qs) => {
    expect((await admin.get(`/api/tickets?${qs}`)).status).toBe(400);
  });

  it('ignores the department filter for staff (they only ever see their own department)', async () => {
    const res = await staff.get('/api/tickets?department=0123456789abcdef01234567');
    expect(res.status).toBe(200);
  });

  it.each<[string, object]>([
    ['unknown top-level key', { colour: 'blue' }],
    ['confidence below the allowed minimum', { routing: { autoRouteConfidence: 0.2 } }],
    ['SLA hours of zero', { slaHours: { Critical: 0 } }],
    ['fractional SLA hours', { slaHours: { Critical: 1.5 } }],
    ['duplicate window too long', { duplicates: { windowDays: 365 } }],
    ['duplicate threshold too low', { duplicates: { threshold: 0.1 } }],
    ['empty update', {}],
  ])('rejects settings: %s', async (_l, body) => {
    expect((await admin.patch('/api/admin/settings').send(body)).status).toBe(400);
  });

  it('rejects unknown categories in the department map', async () => {
    expect(
      (
        await admin
          .patch(`/api/admin/departments/${elecId}`)
          .send({ categories: ['Electrical', 'Magic'] })
      ).status,
    ).toBe(400);
  });
});

describe('malformed requests', () => {
  it('returns 413 for an oversized JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'x'.repeat(200_000) }));
    expect(res.status).toBe(413);
  });

  it('returns 415 for an unsupported charset', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=klingon')
      .send('{}');
    expect(res.status).toBe(415);
  });

  it('never leaks internals in error responses', async () => {
    const res = await admin.get('/api/tickets?limit=500');
    expect(JSON.stringify(res.body)).not.toMatch(/stack|mongo|at \//i);
  });
});

describe('unexpected errors (audit R2)', () => {
  it('a 500 never includes internal details unless SHOW_ERROR_DETAILS is explicitly enabled', async () => {
    const { vi } = await import('vitest');
    const boom = vi
      .spyOn(TicketModel, 'countDocuments')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:27017 /secret/path'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await admin.get('/api/tickets');
    boom.mockRestore();
    quiet.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { message: 'Something went wrong on our side. Please try again.' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|secret|10\.0\.0\.5/);
  });

  it('the setting only accepts true/false', async () => {
    const { validateEnv } = await import('../src/config/env');
    expect(
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: 'x'.repeat(40),
        SHOW_ERROR_DETAILS: 'yes',
      }).success,
    ).toBe(false);
    expect(
      validateEnv({ NODE_ENV: 'development', JWT_SECRET: 'x'.repeat(40), SHOW_ERROR_DETAILS: '' })
        .data?.SHOW_ERROR_DETAILS,
    ).toBe(false);
  });
});
