/**
 * Chooses the AI provider once. Gemini is used only when GEMINI_API_KEY is set.
 * Tests replace the provider with a fake via setAiProvider().
 */
import { env } from '../../config/env';
import { createGeminiProvider } from './geminiProvider';
import type { AiProvider } from './types';

let provider: AiProvider | null | undefined;

export function getAiProvider(): AiProvider | null {
  if (provider === undefined) {
    // Tests never call the real API (even if a key is in .env); they inject fakes instead.
    provider =
      env.GEMINI_API_KEY && env.NODE_ENV !== 'test'
        ? createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL })
        : null;
  }
  return provider;
}

/** For tests only: inject a fake provider (or null for "not configured"). */
export function setAiProvider(p: AiProvider | null | undefined) {
  provider = p;
}
