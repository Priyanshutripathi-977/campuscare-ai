import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { startTestDatabase, stopTestDatabase } from './helpers/db';

const app = createApp();

describe('GET /api/health without a database', () => {
  it('returns 503 "degraded" when MongoDB is not connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', database: 'disconnected' });
  });
});

describe('GET /api/health with a database', () => {
  beforeAll(startTestDatabase, 120_000); // first run may download MongoDB
  afterAll(stopTestDatabase);

  it('returns 200 "ok" when MongoDB is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
    expect(typeof res.body.aiConfigured).toBe('boolean');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('error handling', () => {
  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Route not found/);
  });

  it('returns 400 for malformed JSON instead of crashing', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not valid JSON/);
  });
});
