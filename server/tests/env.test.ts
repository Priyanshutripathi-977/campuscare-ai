import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/config/env';

// Note: tests run with NODE_ENV=test, which gives JWT_SECRET a throwaway default, so the
// "placeholder secret is rejected" rule can't be exercised here; it is verified by starting
// the server with that value (see docs/CHECKLIST.md, "Security").
const base = { NODE_ENV: 'development', JWT_SECRET: 'x'.repeat(48) };

describe('environment validation', () => {
  it('accepts a minimal valid configuration with sensible defaults', () => {
    const r = validateEnv(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      API_PORT: 4000,
      MONGODB_URI: 'mongodb://127.0.0.1:27017/campuscare',
    });
  });

  it('treats empty optional values copied from .env.example as "not set"', () => {
    const r = validateEnv({ ...base, APP_URL: '', GEMINI_API_KEY: '', SMTP_HOST: '' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      APP_URL: undefined,
      GEMINI_API_KEY: undefined,
      SMTP_HOST: undefined,
    });
  });

  it('rejects an invalid database address or URL', () => {
    expect(validateEnv({ ...base, MONGODB_URI: 'postgres://x' }).success).toBe(false);
    expect(validateEnv({ ...base, APP_URL: 'not a url' }).success).toBe(false);
  });

  it('accepts the full .env.example file once a real secret is filled in', async () => {
    const fs = await import('node:fs');
    const { parseEnv } = await import('node:util');
    const example = parseEnv(
      fs.readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'),
    );
    expect(validateEnv({ ...example, JWT_SECRET: 'y'.repeat(64) }).success).toBe(true);
  });
});
