/** Fake AI providers for tests — they return canned model output instead of calling Gemini. */
import type { AiClassification } from '@campuscare/shared';
import type { AiProvider, ComplaintInput } from '../../src/services/ai/types';

export const goodAnswer = (overrides: Partial<AiClassification> = {}): AiClassification => ({
  category: 'Electrical',
  priority: 'High',
  confidence: 0.92,
  summary: 'Ceiling fan in room 101 is not working.',
  extractedLocation: { building: 'Main Building', room: '101' },
  keyDetails: ['Fan stopped yesterday', 'Room is very hot'],
  categoryReason: 'Fans are electrical fittings.',
  priorityReason: 'Affects a whole classroom in hot weather.',
  needsClarification: false,
  clarificationQuestion: null,
  safetyRisk: false,
  ...overrides,
});

/** Provider that returns the given raw text (or the result of a function of the input). */
export function fakeProvider(output: string | ((input: ComplaintInput) => string)) {
  const calls: ComplaintInput[] = [];
  const provider: AiProvider = {
    name: 'gemini',
    model: 'fake-gemini',
    async generate(input) {
      calls.push(input);
      return typeof output === 'function' ? output(input) : output;
    },
  };
  return { provider, calls };
}

/** Provider that throws an error shaped like an HTTP error from the SDK. */
export function failingProvider(status?: number, message = 'boom'): AiProvider {
  return {
    name: 'gemini',
    model: 'fake-gemini',
    async generate() {
      throw Object.assign(new Error(message), status ? { status } : {});
    },
  };
}

/** Provider that never answers (to test timeouts). */
export const hangingProvider: AiProvider = {
  name: 'gemini',
  model: 'fake-gemini',
  generate: () => new Promise<string>(() => {}),
};
