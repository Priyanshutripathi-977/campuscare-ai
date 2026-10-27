import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

const app = createApp();

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);

let student: TestAgent,
  otherStudent: TestAgent,
  admin: TestAgent,
  elecStaff: TestAgent,
  itStaff: TestAgent;
let elecDeptId: string, elecStaffId: string;

beforeEach(async () => {
  await clearDatabase();
  const elec = await createDepartment('ELEC', 'Electrical Maintenance');
  const it = await createDepartment('IT', 'IT Services');
  elecDeptId = String(elec._id);
  await createUser('student', 'student@x.test');
  await createUser('student', 'other@x.test');
  await createUser('admin', 'admin@x.test');
  elecStaffId = String((await createUser('staff', 'elec@x.test', elec._id))._id);
  await createUser('staff', 'it@x.test', it._id);
  [student, otherStudent, admin, elecStaff, itStaff] = await Promise.all([
    loginAs(app, 'student@x.test'),
    loginAs(app, 'other@x.test'),
    loginAs(app, 'admin@x.test'),
    loginAs(app, 'elec@x.test'),
    loginAs(app, 'it@x.test'),
  ]);
});

const submit = (agent: TestAgent, data: unknown = validComplaint) =>
  agent.post('/api/tickets').field('data', JSON.stringify(data));

/** Creates a ticket and moves it to Assigned (ELEC) as the admin. */
async function createAssignedTicket() {
  const { body } = await submit(student);
  const id = body.ticket.ticketId;
  await admin
    .patch(`/api/tickets/${id}/classification`)
    .send({ category: 'Electrical', priority: 'High' });
  await admin
    .patch(`/api/tickets/${id}/assign`)
    .send({ departmentId: elecDeptId, assignedTo: elecStaffId });
  return id as string;
}

describe('creating complaints', () => {
  it('creates a ticket with a unique ID, sent to admin review', async () => {
    const a = await submit(student);
    const b = await submit(student);
    expect(a.status).toBe(201);
    expect(a.body.ticket.ticketId).toMatch(/^CC-\d{4}-\d{6}$/);
    expect(a.body.ticket.ticketId).not.toBe(b.body.ticket.ticketId);
    // No AI key in tests → rule-based suggestion, which always goes to an administrator.
    expect(a.body.ticket).toMatchObject({
      status: 'Under Review',
      needsReview: true,
      category: 'Electrical',
    });
    expect(a.body.ticket.reviewReasons).toEqual([]); // internal reasons are hidden from students
    const adminView = await admin.get(`/api/tickets/${a.body.ticket.ticketId}`);
    expect(adminView.body.ticket.reviewReasons).toContain('ai_unavailable');
    expect(a.body.ticket.statusHistory.map((h: { to: string }) => h.to)).toEqual([
      'Submitted',
      'Under Review',
    ]);
  });

  it('validates fields on the server', async () => {
    const res = await submit(student, {
      title: 'x',
      description: 'short',
      location: { building: '' },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(['title', 'description', 'location.building']),
    );
  });

  it('only students can submit complaints', async () => {
    expect((await submit(admin)).status).toBe(403);
  });

  it('accepts a real PNG image and serves it only to authorized users', async () => {
    const res = await submit(student).attach('image', PNG_1PX, {
      filename: 'photo.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(201);
    expect(res.body.ticket.hasImage).toBe(true);
    const id = res.body.ticket.ticketId;

    const img = await student.get(`/api/tickets/${id}/image`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect((await otherStudent.get(`/api/tickets/${id}/image`)).status).toBe(404);
  });

  it('rejects a non-image file disguised with a .jpg name', async () => {
    const fake = Buffer.from('MZ this is actually an executable, not a picture');
    const res = await submit(student).attach('image', fake, {
      filename: 'cute-cat.jpg',
      contentType: 'image/jpeg',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.image).toMatch(/JPG, PNG or WebP/);
  });

  it('rejects images over the size limit', async () => {
    const big = Buffer.concat([PNG_1PX, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await submit(student).attach('image', big, {
      filename: 'big.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/too large/i);
  });
});

describe('visibility and privacy', () => {
  it('students see only their own tickets', async () => {
    const { body } = await submit(student);
    expect((await otherStudent.get(`/api/tickets/${body.ticket.ticketId}`)).status).toBe(404);
    expect((await otherStudent.get('/api/tickets')).body.total).toBe(0);
    expect((await student.get('/api/tickets')).body.total).toBe(1);
  });

  it('staff see only their department; admin sees everything incl. student email', async () => {
    const id = await createAssignedTicket();
    await submit(student); // unassigned ticket
    expect((await elecStaff.get('/api/tickets')).body.total).toBe(1);
    expect((await itStaff.get('/api/tickets')).body.total).toBe(0);
    expect((await itStaff.get(`/api/tickets/${id}`)).status).toBe(404);
    expect((await admin.get('/api/tickets')).body.total).toBe(2);

    const staffView = (await elecStaff.get(`/api/tickets/${id}`)).body.ticket;
    expect(staffView.student.name).toBeTruthy();
    expect(staffView.student.email).toBeUndefined();
    const adminView = (await admin.get(`/api/tickets/${id}`)).body.ticket;
    expect(adminView.student.email).toBe('student@x.test');
    const studentView = (await student.get(`/api/tickets/${id}`)).body.ticket;
    expect(studentView.routing).toBeNull(); // internal routing info hidden from students
  });

  it('requires login for everything', async () => {
    const { default: request } = await import('supertest');
    expect((await request(app).get('/api/tickets')).status).toBe(401);
  });
});

describe('filters and search', () => {
  it('filters by status / needsReview and searches by title or ticket id', async () => {
    const id = await createAssignedTicket();
    await submit(student, { ...validComplaint, title: 'Leaking tap in hostel' });
    const byStatus = await admin.get('/api/tickets?status=Assigned');
    expect(byStatus.body.items.map((t: { ticketId: string }) => t.ticketId)).toEqual([id]);
    expect((await admin.get('/api/tickets?needsReview=true')).body.total).toBe(1);
    expect((await admin.get('/api/tickets?q=leaking')).body.items[0].title).toBe(
      'Leaking tap in hostel',
    );
    expect((await admin.get(`/api/tickets?q=${id}`)).body.total).toBe(1);
    expect((await admin.get('/api/tickets?q=(.*')).status).toBe(200); // regex chars are escaped
    expect((await admin.get('/api/tickets?status=Banana')).status).toBe(400);
  });

  it('flags overdue tickets', async () => {
    const id = await createAssignedTicket();
    await TicketModel.updateOne({ ticketId: id }, { dueAt: new Date(Date.now() - 1000) });
    const res = await admin.get('/api/tickets?overdue=true');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].overdue).toBe(true);
  });
});

describe('classification, assignment and status workflow', () => {
  it('requires classification before assignment, then sets a deadline', async () => {
    const { body } = await submit(student);
    const id = body.ticket.ticketId;
    // Simulate a ticket with no classification at all (e.g. the analysis step crashed).
    await TicketModel.updateOne({ ticketId: id }, { category: null, priority: null });
    const early = await admin.patch(`/api/tickets/${id}/assign`).send({ departmentId: elecDeptId });
    expect(early.status).toBe(409);

    const classified = await admin
      .patch(`/api/tickets/${id}/classification`)
      .send({ category: 'Electrical', priority: 'Critical' });
    expect(classified.body.ticket.dueAt).toBeTruthy();

    const assigned = await admin
      .patch(`/api/tickets/${id}/assign`)
      .send({ departmentId: elecDeptId, assignedTo: elecStaffId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.ticket).toMatchObject({ status: 'Assigned', needsReview: false });
    expect(assigned.body.ticket.department.name).toBe('Electrical Maintenance');
    expect(assigned.body.ticket.routing.method).toBe('manual');
  });

  it('rejects assigning staff from a different department', async () => {
    const { body } = await submit(student);
    const id = body.ticket.ticketId;
    await admin
      .patch(`/api/tickets/${id}/classification`)
      .send({ category: 'IT', priority: 'Low' });
    const itStaffUser = (await itStaff.get('/api/auth/me')).body.user;
    const res = await admin
      .patch(`/api/tickets/${id}/assign`)
      .send({ departmentId: elecDeptId, assignedTo: itStaffUser.id });
    expect(res.status).toBe(400);
  });

  it('students and other-department staff cannot change status or classify', async () => {
    const id = await createAssignedTicket();
    expect(
      (await student.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' })).status,
    ).toBe(403);
    expect(
      (
        await student
          .patch(`/api/tickets/${id}/classification`)
          .send({ category: 'IT', priority: 'Low' })
      ).status,
    ).toBe(403);
    expect(
      (await itStaff.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' })).status,
    ).toBe(404);
    expect(
      (await elecStaff.patch(`/api/tickets/${id}/assign`).send({ departmentId: elecDeptId }))
        .status,
    ).toBe(403);
  });

  it('enforces the state machine and requires confirmation + note to resolve', async () => {
    const id = await createAssignedTicket();
    // Cannot jump straight to Resolved.
    expect(
      (
        await elecStaff
          .patch(`/api/tickets/${id}/status`)
          .send({ status: 'Resolved', confirm: true, note: 'Fixed it' })
      ).status,
    ).toBe(409);

    expect(
      (await elecStaff.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' })).status,
    ).toBe(200);

    const noConfirm = await elecStaff
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'Resolved', note: 'Fixed it' });
    expect(noConfirm.status).toBe(400);
    expect(noConfirm.body.error.details.fieldErrors.confirm).toBeTruthy();
    const noNote = await elecStaff
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'Resolved', confirm: true });
    expect(noNote.status).toBe(400);

    const ok = await elecStaff
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'Resolved', confirm: true, note: 'Replaced the faulty wiring' });
    expect(ok.status).toBe(200);
    expect(ok.body.ticket.resolvedAt).toBeTruthy();
    expect(ok.body.ticket.statusHistory.at(-1)).toMatchObject({
      from: 'In Progress',
      to: 'Resolved',
      note: 'Replaced the faulty wiring',
    });
  });

  it('lets only the owning student reopen a resolved ticket, with a reason', async () => {
    const id = await createAssignedTicket();
    await elecStaff.patch(`/api/tickets/${id}/status`).send({ status: 'In Progress' });
    await elecStaff
      .patch(`/api/tickets/${id}/status`)
      .send({ status: 'Resolved', confirm: true, note: 'Fixed the fan' });

    expect(
      (await admin.post(`/api/tickets/${id}/reopen`).send({ reason: 'Still broken' })).status,
    ).toBe(403);
    expect(
      (await otherStudent.post(`/api/tickets/${id}/reopen`).send({ reason: 'Still broken' }))
        .status,
    ).toBe(404);
    expect((await student.post(`/api/tickets/${id}/reopen`).send({ reason: '' })).status).toBe(400);
    const ok = await student
      .post(`/api/tickets/${id}/reopen`)
      .send({ reason: 'The fan stopped again today' });
    expect(ok.status).toBe(200);
    expect(ok.body.ticket.status).toBe('Reopened');
  });

  it('lets the student and staff add updates to the conversation', async () => {
    const id = await createAssignedTicket();
    await student.post(`/api/tickets/${id}/updates`).send({ message: 'It is getting worse.' });
    const res = await elecStaff
      .post(`/api/tickets/${id}/updates`)
      .send({ message: 'Technician on the way.' });
    expect(res.status).toBe(201);
    expect(res.body.ticket.updates.map((u: { message: string }) => u.message)).toEqual([
      'It is getting worse.',
      'Technician on the way.',
    ]);
    expect(
      (await otherStudent.post(`/api/tickets/${id}/updates`).send({ message: 'hello there' }))
        .status,
    ).toBe(404);
  });
});

describe('admin endpoints', () => {
  it('returns real stats scoped by role', async () => {
    await createAssignedTicket();
    await submit(student);
    const all = (await admin.get('/api/admin/stats')).body.stats;
    expect(all).toMatchObject({ scope: 'all', total: 2, open: 2, needsReview: 1 });
    expect(all.byStatus.Assigned).toBe(1);
    expect(all.byCategory.Electrical).toBe(2); // one confirmed by admin, one rules suggestion
    expect(all.byCategory.Unclassified).toBeUndefined();
    expect(all.createdPerDay).toHaveLength(14);
    expect(all.createdPerDay.at(-1).count).toBe(2);

    // Open tickets by priority (resolved ones excluded) and per-department performance.
    expect(all.openByPriority).toMatchObject({ High: 1, Medium: 1, Critical: 0 }); // Medium = keyword suggestion
    expect(all.departmentPerformance).toEqual([
      {
        name: 'Electrical Maintenance',
        open: 1,
        resolved: 0,
        overdue: 0,
        avgResolutionHours: null,
      },
    ]);

    const dept = (await elecStaff.get('/api/admin/stats')).body.stats;
    expect(dept).toMatchObject({ scope: 'department', total: 1 });
    expect((await student.get('/api/admin/stats')).status).toBe(403);
  });

  it('lists departments and staff for assignment (staff list is admin-only)', async () => {
    expect((await admin.get('/api/admin/departments')).body.departments).toHaveLength(2);
    const staff = (await admin.get(`/api/admin/staff?department=${elecDeptId}`)).body.staff;
    expect(staff.map((s: { id: string }) => s.id)).toEqual([elecStaffId]);
    expect((await elecStaff.get('/api/admin/staff')).status).toBe(403);
  });
});

describe('dashboard performance numbers', () => {
  it('counts open/resolved/overdue per department and the average time to resolve', async () => {
    const { body: a } = await submit(student);
    const { body: b } = await submit(student);
    for (const t of [a.ticket, b.ticket]) {
      await admin
        .patch(`/api/tickets/${t.ticketId}/classification`)
        .send({ category: 'Electrical', priority: 'Critical' });
      await admin.patch(`/api/tickets/${t.ticketId}/assign`).send({ departmentId: elecDeptId });
    }
    // Ticket A: resolved exactly 2 hours after it was created.
    const created = (await TicketModel.findOne({ ticketId: a.ticket.ticketId }).lean())!.createdAt;
    await TicketModel.updateOne(
      { ticketId: a.ticket.ticketId },
      { status: 'Resolved', resolvedAt: new Date(created.getTime() + 2 * 3600_000) },
    );
    // Ticket B: still open and past its deadline.
    await TicketModel.updateOne(
      { ticketId: b.ticket.ticketId },
      { dueAt: new Date(Date.now() - 60_000) },
    );

    const s = (await admin.get('/api/admin/stats')).body.stats;
    expect(s.departmentPerformance).toEqual([
      { name: 'Electrical Maintenance', open: 1, resolved: 1, overdue: 1, avgResolutionHours: 2 },
    ]);
    expect(s.openByPriority.Critical).toBe(1); // the resolved Critical ticket is not counted
    expect(s.byPriority.Critical).toBe(2);
  });
});

describe('audit regressions B3–B5', () => {
  it('B3: "overdue" combined with status "Resolved" returns nothing (resolved tickets are never overdue)', async () => {
    const id = await createAssignedTicket();
    await TicketModel.updateOne({ ticketId: id }, { dueAt: new Date(Date.now() - 1000) });
    expect((await admin.get('/api/tickets?overdue=true&status=Resolved')).body.total).toBe(0);
    expect((await admin.get('/api/tickets?overdue=true&status=Assigned')).body.total).toBe(1);
    expect((await admin.get('/api/tickets?overdue=true')).body.total).toBe(1);
  });

  it('B4: "Due soonest" lists open tickets before resolved ones', async () => {
    const resolved = await createAssignedTicket();
    const open = await createAssignedTicket();
    await TicketModel.updateOne(
      { ticketId: resolved },
      { status: 'Resolved', resolvedAt: new Date(), dueAt: new Date(Date.now() - 86_400_000) },
    );
    await TicketModel.updateOne({ ticketId: open }, { dueAt: new Date(Date.now() + 86_400_000) });
    const ids = (await admin.get('/api/tickets?sort=due')).body.items.map(
      (t: { ticketId: string }) => t.ticketId,
    );
    expect(ids.indexOf(open)).toBeLessThan(ids.indexOf(resolved));
  });

  it('B5: a photo missing from disk gives a clean JSON 404, not a 500', async () => {
    const res = await submit(student).attach('image', PNG_1PX, {
      filename: 'p.png',
      contentType: 'image/png',
    });
    const doc = await TicketModel.findOne({ ticketId: res.body.ticket.ticketId }).lean();
    const fs = await import('node:fs/promises');
    await fs.rm(`${process.env.UPLOAD_DIR}/${doc!.image!.filename}`);
    const img = await student.get(`/api/tickets/${res.body.ticket.ticketId}/image`);
    expect(img.status).toBe(404);
    expect(img.headers['content-type']).toMatch(/application\/json/);
    expect(img.body.error.message).toMatch(/no longer available/);
  });
});
