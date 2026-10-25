/** Calls Google Gemini. Runs ONLY on the server — the API key never reaches the browser. */
import { GoogleGenAI } from '@google/genai';
import { buildUserPrompt, GEMINI_RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from './prompt';
import type { AiProvider } from './types';

export function createGeminiProvider({
  apiKey,
  model,
  baseUrl,
}: {
  apiKey: string;
  model: string;
  /** Optional: a different server address (used by tests to run the real SDK against a local fake). */
  baseUrl?: string;
}): AiProvider {
  const client = new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
  return {
    name: 'gemini',
    model,
    async generate(input, signal) {
      const response = await client.models.generateContent({
        model,
        contents: buildUserPrompt(input),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0, // as repeatable as possible
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          responseJsonSchema: GEMINI_RESPONSE_SCHEMA,
          abortSignal: signal,
        },
      });
      const text = response.text;
      if (!text) throw new Error('empty_response');
      return text;
    },
  };
}
