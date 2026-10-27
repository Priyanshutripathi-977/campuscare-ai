/**
 * Reads environment variables from the root .env file and validates them.
 * If something required is missing or wrong, the server refuses to start
 * with a clear message instead of failing mysteriously later.
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load ../../.env (the repo root), relative to this file.
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

/** Values from .env.example that must never be used as real secrets. */
const PLACEHOLDER_SECRETS = ['replace-with-a-long-random-string'];

/** Empty values in .env (e.g. `APP_URL=`) mean "not set". */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
    .default('mongodb://127.0.0.1:27017/campuscare'),
  // Signs login tokens. Tests get a throwaway value; everywhere else it must be set in .env.
  JWT_SECRET:
    process.env.NODE_ENV === 'test'
      ? z.string().default('test-secret-test-secret-test-secret-123')
      : z
          .string()
          .min(32, 'must be at least 32 characters (see .env.example)')
          .refine((v) => !PLACEHOLDER_SECRETS.includes(v.trim()), {
            message:
              'is still the placeholder from .env.example — generate a real random secret (see .env.example)',
          }),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
  UPLOAD_DIR: z.string().default(path.resolve(import.meta.dirname, '../../uploads')),
  // Server-only secret. Never sent to the browser (only "is it configured?" is exposed).
  GEMINI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.5-flash-lite'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(20_000),
  // Optional email (SMTP). If SMTP_HOST is empty, only in-app notifications are used.
  SMTP_HOST: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().trim().default('CampusCare AI <no-reply@example.com>'),
  // Developer aid: include the real error message in 500 responses. OFF by default and always
  // ignored in production, so internals (file paths, database hosts) are never sent to users.
  SHOW_ERROR_DETAILS: z
    .preprocess(emptyToUndefined, z.enum(['true', 'false']).default('false'))
    .transform((v) => v === 'true'),
  // Used to build links in emails (defaults to the frontend address).
  APP_URL: z.preprocess(emptyToUndefined, z.url().optional()),
});

/** Validates a set of environment variables (exported so tests can check the rules). */
export function validateEnv(source: NodeJS.ProcessEnv) {
  return EnvSchema.safeParse(source);
}

const parsed = validateEnv(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
