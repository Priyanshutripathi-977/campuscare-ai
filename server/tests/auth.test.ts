import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { startTestDatabase, stopTestDatabase } from './helpers/db';
import { clearDatabase, createUser, PASSWORD } from './helpers/fixtures';

const app = createApp();

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
beforeEach(clearDatabase);

describe('POST /api/auth/register', () => {
  const body = { name: 'Test Student', email: 'New@Example.com', password: 'abcdef12' };

  it('creates a STUDENT account, sets an httpOnly cookie, never returns the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...body, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@example.com', role: 'student' }); // role ignored
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/cc_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects weak passwords and invalid emails with field errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });

  it('rejects duplicate emails', async () => {
    await request(app).post('/api/auth/register').send(body);
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  it('rejects NoSQL-injection style objects instead of strings', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });
});

describe('login / me / logout', () => {
  it('logs in, returns the current user, and logs out', async () => {
    await createUser('admin', 'admin@x.test');
    const agent = request.agent(app);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'ADMIN@x.test', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('admin');

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('admin@x.test');

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('uses the same message for unknown email and wrong password', async () => {
    await createUser('student', 's@x.test');
    const a = await request(app)
      .post('/api/auth/login')
      .send({ email: 's@x.test', password: 'wrong-pass1' });
    const b = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@x.test', password: 'wrong-pass1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('rejects a forged token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'cc_token=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.');
    expect(res.status).toBe(401);
  });

  it('rate-limits repeated failed logins', async () => {
    const limited = createApp({ rateLimits: { login: 3 } });
    for (let i = 0; i < 3; i++) {
      await request(limited)
        .post('/api/auth/login')
        .send({ email: 'a@x.test', password: 'wrong-pass1' });
    }
    const res = await request(limited)
      .post('/api/auth/login')
      .send({ email: 'a@x.test', password: 'wrong-pass1' });
    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/too many/i);
  });
});
