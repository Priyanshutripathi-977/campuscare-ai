/**
 * Runs OUR Gemini provider with the REAL @google/genai SDK over real HTTP, against a local
 * fake Gemini server. This checks the request we send (key header, model, system prompt,
 * JSON-schema output mode) and how we read real-shaped responses and HTTP errors —
 * without needing a Google API key.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createGeminiProvider } from '../src/services/ai/geminiProvider';
import { understandComplaint } from '../src/services/ai/complaintUnderstanding';
import { goodAnswer } from './helpers/fakeAi';

interface Captured {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
}
let server: http.Server;
let baseUrl: string;
let captured: Captured[] = [];
/** What the fake server replies with for the next request. */
let reply: { status: number; body: unknown; delayMs?: number } = { status: 200, body: {} };

const geminiResponse = (text: string) => ({
  candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
});

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      captured.push({
        method: req.method!,
        url: req.url!,
        headers: req.headers,
        body: raw ? JSON.parse(raw) : {},
      });
      setTimeout(() => {
        res.writeHead(reply.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply.body));
      }, reply.delayMs ?? 0);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  captured = [];
});

const input = {
  title: 'Socket sparking in Lab 3',
  description: 'The wall socket in Lab 3 sparked and there is a burning smell near bench 4.',
  location: { building: 'Engineering Block B', room: 'Lab 3' },
};
const provider = () =>
  createGeminiProvider({ apiKey: 'test-key-123', model: 'gemini-test-model', baseUrl });
const quiet = { log: () => {}, timeoutMs: 3000 };

describe('Gemini provider with the real SDK (local fake server)', () => {
  it('sends a correct request: key header, model, system prompt, JSON schema mode, temperature 0', async () => {
    reply = { status: 200, body: geminiResponse(JSON.stringify(goodAnswer())) };
    const r = await understandComplaint(input, provider(), quiet);

    expect(captured).toHaveLength(1);
    const req = captured[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toMatch(/\/models\/gemini-test-model:generateContent$/);
    expect(req.headers['x-goog-api-key']).toBe('test-key-123');
    const body = req.body as {
      contents: { parts: { text: string }[] }[];
      systemInstruction: { parts: { text: string }[] };
      generationConfig: Record<string, unknown>;
    };
    expect(body.systemInstruction.parts[0]!.text).toMatch(/triage assistant/);
    expect(body.contents[0]!.parts[0]!.text).toContain('Socket sparking in Lab 3');
    expect(body.generationConfig).toMatchObject({
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 1024,
    });
    expect(body.generationConfig.responseJsonSchema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['category', 'priority']),
    });
    // Never send the student's identity.
    expect(JSON.stringify(body)).not.toMatch(/@|studentId/);

    expect(r).toMatchObject({
      source: 'gemini',
      model: 'gemini-test-model',
      valid: true,
      category: 'Electrical',
    });
  });

  it('falls back when Gemini returns text that is not valid JSON', async () => {
    reply = { status: 200, body: geminiResponse('Sure! It is an electrical issue.') };
    const r = await understandComplaint(input, provider(), quiet);
    expect(r).toMatchObject({ source: 'fallback_rules', valid: false, error: 'invalid_json' });
  });

  it('falls back when the response has no text (e.g. blocked by safety filters)', async () => {
    reply = { status: 200, body: { candidates: [{ finishReason: 'SAFETY', index: 0 }] } };
    const r = await understandComplaint(input, provider(), quiet);
    expect(r).toMatchObject({ source: 'fallback_rules', error: 'empty_response' });
  });

  it.each([
    [429, 'rate_limited'],
    [403, 'auth_failed'],
    [400, 'provider_error'],
    [503, 'provider_unavailable'],
  ])('maps a real HTTP %s error from the SDK to "%s"', async (status, expected) => {
    reply = { status, body: { error: { code: status, message: 'nope', status: 'ERROR' } } };
    const r = await understandComplaint(input, provider(), quiet);
    expect(r).toMatchObject({ source: 'fallback_rules', error: expected });
  });

  it('times out a slow Gemini instead of hanging the request', async () => {
    reply = { status: 200, body: geminiResponse(JSON.stringify(goodAnswer())), delayMs: 2000 };
    const started = Date.now();
    const r = await understandComplaint(input, provider(), { log: () => {}, timeoutMs: 300 });
    expect(r).toMatchObject({ source: 'fallback_rules', error: 'timeout' });
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
