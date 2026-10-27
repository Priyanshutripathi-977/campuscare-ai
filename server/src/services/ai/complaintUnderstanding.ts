/**
 * The complaint-understanding pipeline:
 *
 *   provider (Gemini) ──► raw text ──► JSON.parse ──► zod validation ──► AiResult
 *          │ not configured / error / timeout / invalid JSON / fails validation
 *          └──────────────────────────────► rule-based fallback ──► AiResult (error recorded)
 *
 * The result is only a SUGGESTION. routing.service.ts decides what happens with it.
 */
import { AiClassificationSchema } from '@campuscare/shared';
import { classifyWithRules } from './ruleBasedClassifier';
import type { AiProvider, AiResult, ComplaintInput } from './types';

export class AiOutputError extends Error {}

/** Models sometimes wrap JSON in ```json fences even in JSON mode — remove them. */
function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiOutputError('invalid_json');
  }
}

/** Short, safe description of what went wrong (no stack traces, no API details). */
function describeFailure(err: unknown): string {
  if (err instanceof AiOutputError) return err.message;
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message === 'timeout') return 'timeout';
    const status = (err as { status?: number }).status;
    if (status === 429) return 'rate_limited';
    if (status === 401 || status === 403) return 'auth_failed';
    if (status && status >= 500) return 'provider_unavailable';
    if (err.message === 'empty_response') return 'empty_response';
  }
  return 'provider_error';
}

export async function understandComplaint(
  input: ComplaintInput,
  provider: AiProvider | null,
  {
    timeoutMs = 20_000,
    log = console.warn,
  }: { timeoutMs?: number; log?: (msg: string) => void } = {},
): Promise<AiResult> {
  let failure: string | null = provider ? null : 'not_configured';

  if (provider) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const raw = await Promise.race([
        provider.generate(input, controller.signal),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new Error('timeout'))),
        ),
      ]);
      const parsed = AiClassificationSchema.safeParse(extractJson(raw));
      if (!parsed.success) {
        const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || 'root'))];
        throw new AiOutputError(`schema_validation_failed: ${fields.slice(0, 5).join(', ')}`);
      }
      return {
        ...parsed.data,
        source: 'gemini',
        model: provider.model,
        valid: true,
        error: null,
        processedAt: new Date(),
      };
    } catch (err) {
      failure = describeFailure(err);
      log(`[ai] ${provider.name} failed (${failure}); using rule-based fallback`);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ...classifyWithRules(input),
    source: 'fallback_rules',
    model: null,
    valid: provider === null, // false = the model was tried and its answer was unusable
    error: failure,
    processedAt: new Date(),
  };
}
