/**
 * Authorization matrix: every protected endpoint × every kind of user.
 * 401 = not logged in · 403 = wrong role · 404 = cannot see this ticket (we don't reveal it exists).
 * A fresh ticket is created for each request so earlier requests can't affect later ones.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { createApp } from '../src/app';
import { TicketModel } from '../src/models/Ticket';
import { DepartmentModel } from '../src/models/Department';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createUser, loginAs, validComplaint } from './helpers/fixtures';

const app = createApp({ rateLimits: { createTicket: 10_000, global: 100_000 } });
type Who = 'anon' | 'owner' | 'otherStudent' | 'deptStaff' | 'otherStaff' | 'admin';
const agents = {} as Record<Exclude<Who, 'anon'>, TestAgent>;
let elecId: string, itId: string, elecStaffId: string;

beforeAll(async () => {
  await startTestDatabase();
  await clearDatabase();
  elecId = String(
    (await DepartmentModel.create({ code: 'ELEC', name: 'Electrical', categories: ['Electrical'] }))
      ._id,
  );
  itId = String((await DepartmentModel.create({ code: 'IT', name: 'IT', categories: ['IT'] }))._id);
  await createUser('student', 'owner@x.test');
  await createUser('student', 'other@x.test');
  await createUser('admin', 'admin@x.test');
  elecStaffId = String(
    (await createUser('staff', 'elec@x.test', DepartmentModel.hydrate({ _id: elecId })._id))._id,
  );
  await createUser('staff', 'it@x.test', DepartmentModel.hydrate({ _id: itId })._id);
  agents.owner = await loginAs(app, 'owner@x.test');
  agents.otherStudent = await loginAs(app, 'other@x.test');
  agents.admin = await loginAs(app, 'admin@x.test');
  agents.deptStaff = await loginAs(app, 'elec@x.test');
  agents.otherStaff = await loginAs(app, 'it@x.test');
});
afterAll(stopTestDatabase);

/** A ticket owned by "owner", assigned to the Electrical department, in the given status. */
async function ticketIn(status: 'Assigned' | 'In Progress' | 'Resolved' | 'Under Review') {
  const res = await agents.owner.post('/api/tickets').field('data', JSON.stringify(validComplaint));
  const ticketId = res.body.ticket.ticketId as string;
  await TicketModel.updateOne(
    { ticketId },
    {
      status,
      department: status === 'Under Review' ? null : elecId,
      category: 'Electrical',
      priority: 'High',
    },
  );
  return ticketId;
}

const client = (who: Who) => (who === 'anon' ? request(app) : agents[who]);

interface Row {
  name: string;
  setup?: () => Promise<string>;
  send: (who: Who, ticketId: string) => request.Test;
  expect: Record<Who, number>;
}

const OPEN = () => ticketIn('Assigned');
const rows: Row[] = [
  {
    name: 'GET /auth/me',
    send: (w) => client(w).get('/api/auth/me'),
    expect: {
      anon: 401,
      owner: 200,
      otherStudent: 200,
      deptStaff: 200,
      otherStaff: 200,
      admin: 200,
    },
  },
  {
    name: 'POST /tickets',
    send: (w) => client(w).post('/api/tickets').field('data', JSON.stringify(validComplaint)),
    expect: {
      anon: 401,
      owner: 201,
      otherStudent: 201,
      deptStaff: 403,
      otherStaff: 403,
      admin: 403,
    },
  },
  {
    name: 'GET /tickets',
    send: (w) => client(w).get('/api/tickets'),
    expect: {
      anon: 401,
      owner: 200,
      otherStudent: 200,
      deptStaff: 200,
      otherStaff: 200,
      admin: 200,
    },
  },
  {
    name: 'GET /tickets/:id',
    setup: OPEN,
    send: (w, id) => client(w).get(`/api/tickets/${id}`),
    expect: {
      anon: 401,
      owner: 200,
      otherStudent: 404,
      deptStaff: 200,
      otherStaff: 404,
      admin: 200,
    },
  },
  {
    name: 'GET /tickets/:id/image',
    setup: OPEN,
    send: (w, id) => client(w).get(`/api/tickets/${id}/image`),
    expect: {
      anon: 401,
      owner: 404,
      otherStudent: 404,
      deptStaff: 404,
      otherStaff: 404,
      admin: 404,
    },
  },
  {
    name: 'POST /tickets/:id/updates',
    setup: OPEN,
    send: (w, id) => client(w).post(`/api/tickets/${id}/updates`).send({ message: 'Any news?' }),
    expect: {
      anon: 401,
      owner: 201,
      otherStudent: 404,
      deptStaff: 201,
      otherStaff: 404,
      admin: 201,
    },
  },
  {
    name: 'PATCH /tickets/:id/status',
    setup: OPEN,
    send: (w, id) => client(w).patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' }),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 200,
      otherStaff: 404,
      admin: 200,
    },
  },
  {
    name: 'POST /tickets/:id/reopen',
    setup: () => ticketIn('Resolved'),
    send: (w, id) => client(w).post(`/api/tickets/${id}/reopen`).send({ reason: 'Broken again' }),
    expect: {
      anon: 401,
      owner: 200,
      otherStudent: 404,
      deptStaff: 403,
      otherStaff: 403,
      admin: 403,
    },
  },
  {
    name: 'PATCH /tickets/:id/classification',
    setup: OPEN,
    send: (w, id) =>
      client(w)
        .patch(`/api/tickets/${id}/classification`)
        .send({ category: 'IT', priority: 'Low' }),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'PATCH /tickets/:id/assign',
    setup: OPEN,
    send: (w, id) =>
      client(w)
        .patch(`/api/tickets/${id}/assign`)
        .send({ departmentId: elecId, assignedTo: elecStaffId }),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'POST /tickets/:id/reanalyze',
    setup: () => ticketIn('Under Review'),
    send: (w, id) => client(w).post(`/api/tickets/${id}/reanalyze`),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'GET /admin/stats',
    send: (w) => client(w).get('/api/admin/stats'),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 200,
      otherStaff: 200,
      admin: 200,
    },
  },
  {
    name: 'GET /admin/departments',
    send: (w) => client(w).get('/api/admin/departments'),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 200,
      otherStaff: 200,
      admin: 200,
    },
  },
  {
    name: 'GET /admin/staff',
    send: (w) => client(w).get('/api/admin/staff'),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'PATCH /admin/departments/:id',
    send: (w) =>
      client(w)
        .patch(`/api/admin/departments/${itId}`)
        .send({ categories: ['IT'] }),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'GET /admin/settings',
    send: (w) => client(w).get('/api/admin/settings'),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'PATCH /admin/settings',
    send: (w) =>
      client(w)
        .patch('/api/admin/settings')
        .send({ slaHours: { Low: 168 } }),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'GET /notifications',
    send: (w) => client(w).get('/api/notifications'),
    expect: {
      anon: 401,
      owner: 200,
      otherStudent: 200,
      deptStaff: 200,
      otherStaff: 200,
      admin: 200,
    },
  },
  {
    name: 'POST /notifications/read-all',
    send: (w) => client(w).post('/api/notifications/read-all'),
    expect: {
      anon: 401,
      owner: 200,
      otherStudent: 200,
      deptStaff: 200,
      otherStaff: 200,
      admin: 200,
    },
  },
  {
    name: "PATCH /notifications/:id/read (someone else's or missing)",
    send: (w) => client(w).patch('/api/notifications/0123456789abcdef01234567/read'),
    expect: {
      anon: 401,
      owner: 404,
      otherStudent: 404,
      deptStaff: 404,
      otherStaff: 404,
      admin: 404,
    },
  },
  {
    name: 'GET /admin/duplicates',
    send: (w) => client(w).get('/api/admin/duplicates'),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 200,
    },
  },
  {
    name: 'PATCH /admin/duplicates/:id',
    send: (w) =>
      client(w)
        .patch('/api/admin/duplicates/0123456789abcdef01234567')
        .send({ decision: 'dismissed' }),
    expect: {
      anon: 401,
      owner: 403,
      otherStudent: 403,
      deptStaff: 403,
      otherStaff: 403,
      admin: 404,
    },
  },
];

const WHO: Who[] = ['anon', 'owner', 'otherStudent', 'deptStaff', 'otherStaff', 'admin'];
const cases = rows.flatMap((r) => WHO.map((who) => ({ ...r, who, code: r.expect[who] })));

describe('authorization matrix', () => {
  it.each(cases)('$name as $who → $code', async ({ setup, send, who, code }) => {
    const ticketId = setup ? await setup() : '';
    const res = await send(who, ticketId);
    expect(res.status, JSON.stringify(res.body)).toBe(code);
  });
});

describe('role escalation and tampering', () => {
  it('cannot register as admin or staff', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Mallory',
      email: 'm@x.test',
      password: 'abcdef12',
      role: 'admin',
      department: elecId,
    });
    expect(res.body.user).toMatchObject({ role: 'student', department: null });
  });

  it('a student cannot set status, department or owner while creating a ticket', async () => {
    const res = await agents.owner.post('/api/tickets').field(
      'data',
      JSON.stringify({
        ...validComplaint,
        status: 'Resolved',
        department: itId,
        student: 'someone-else',
        ticketId: 'CC-2026-999999',
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.ticket.status).not.toBe('Resolved');
    expect(res.body.ticket.ticketId).not.toBe('CC-2026-999999');
    const saved = await TicketModel.findOne({ ticketId: res.body.ticket.ticketId }).lean();
    expect(String(saved!.department ?? '')).not.toBe(itId);
  });

  it('staff cannot move a ticket in a way their role does not allow', async () => {
    const id = await ticketIn('Assigned');
    expect(
      (await agents.deptStaff.patch(`/api/tickets/${id}/status`).send({ status: 'Under Review' }))
        .status,
    ).toBe(409);
    expect(
      (await agents.deptStaff.patch(`/api/tickets/${id}/status`).send({ status: 'Reopened' }))
        .status,
    ).toBe(409);
  });

  it('a session for a deleted user stops working immediately', async () => {
    const temp = await createUser('student', 'temp@x.test');
    const agent = await loginAs(app, 'temp@x.test');
    await temp.deleteOne();
    expect((await agent.get('/api/tickets')).status).toBe(401);
  });
});
