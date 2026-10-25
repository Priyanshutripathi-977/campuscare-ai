/** The demo seed: creates labelled demo data, and --reset removes ONLY demo data. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { TicketModel } from '../src/models/Ticket';
import { UserModel } from '../src/models/User';
import { NotificationModel } from '../src/models/Notification';
import { DuplicateSuggestionModel } from '../src/models/DuplicateSuggestion';
import { DEMO_PASSWORD, seedDemoData } from '../src/seed/demoData';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createUser, loginAs, validComplaint } from './helpers/fixtures';
import request from 'supertest';

const app = createApp({ rateLimits: { createTicket: 10_000 } });
beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
beforeEach(clearDatabase);

describe('demo seed', () => {
  it('creates labelled demo data with real keyword-classifier analysis', async () => {
    const r = await seedDemoData();
    expect(r).toMatchObject({ departments: 7, users: 9, tickets: 15, duplicateSuggestions: 1 });
    const tickets = await TicketModel.find().lean();
    expect(tickets.every((t) => t.isDemo)).toBe(true);
    expect(tickets.every((t) => t.ai?.source === 'fallback_rules')).toBe(true); // honest source
    const vague = tickets.find((t) => t.title === 'Something is broken again');
    expect(vague).toMatchObject({ status: 'Under Review', ai: { needsClarification: true } });
    expect((await UserModel.find({ isDemo: true })).length).toBe(9);
  });

  it('running again without --reset does not duplicate tickets', async () => {
    await seedDemoData();
    const again = await seedDemoData();
    expect(again.skippedTickets).toBe(true);
    expect(await TicketModel.countDocuments()).toBe(15);
  });

  it('--reset removes demo data and everything demo accounts created, but keeps real users and their tickets', async () => {
    await seedDemoData();
    // A real student with a real ticket…
    await createUser('student', 'real@college.edu');
    const real = await loginAs(app, 'real@college.edu');
    const realTicket = (
      await real.post('/api/tickets').field('data', JSON.stringify(validComplaint))
    ).body.ticket.ticketId;
    // …and a practice ticket submitted with a demo account.
    const demo = request.agent(app);
    await demo
      .post('/api/auth/login')
      .send({ email: 'student@campuscare.test', password: DEMO_PASSWORD });
    const practice = (
      await demo
        .post('/api/tickets')
        .field(
          'data',
          JSON.stringify({ ...validComplaint, title: 'Practice ticket from the demo' }),
        )
    ).body.ticket.ticketId;
    expect(practice).toBeTruthy();

    await seedDemoData({ reset: true });

    expect(await TicketModel.exists({ ticketId: practice })).toBeNull(); // practice ticket gone
    expect(await TicketModel.exists({ ticketId: realTicket })).not.toBeNull(); // real ticket kept
    expect(await UserModel.exists({ email: 'real@college.edu' })).not.toBeNull();
    // No ticket or notification points at a user that no longer exists.
    const userIds = new Set((await UserModel.find().distinct('_id')).map(String));
    expect((await TicketModel.find().lean()).every((t) => userIds.has(String(t.student)))).toBe(
      true,
    );
    expect((await NotificationModel.find().lean()).every((n) => userIds.has(String(n.user)))).toBe(
      true,
    );
    // Fresh demo data is back, with its duplicate pair.
    expect(await TicketModel.countDocuments({ isDemo: true })).toBe(15);
    expect(await DuplicateSuggestionModel.countDocuments()).toBe(1);
  });
});
