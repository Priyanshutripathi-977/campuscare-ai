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

const EnvSchema = z.object({
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
      : z.string().min(32, 'must be at least 32 characters (see .env.example)'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
  UPLOAD_DIR: z.string().default(path.resolve(import.meta.dirname, '../../uploads')),
  GEMINI_API_KEY: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
