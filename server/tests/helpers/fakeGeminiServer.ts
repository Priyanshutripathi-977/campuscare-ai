/** A tiny local HTTP server that answers like the Gemini REST API (for real-SDK tests). */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export async function startFakeGemini() {
  const requests: { url: string; body: { contents?: { parts?: { text?: string }[] }[] } }[] = [];
  let answer: (prompt: string) => { status: number; body: unknown } = () => ({
    status: 500,
    body: {},
  });

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      requests.push({ url: req.url ?? '', body });
      const prompt = body.contents?.[0]?.parts?.[0]?.text ?? '';
      const { status, body: out } = answer(prompt);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));

  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    /** Decide the reply based on the prompt the SDK sent. */
    onRequest(fn: typeof answer) {
      answer = fn;
    },
    /** Wraps model JSON text in a real-shaped Gemini response. */
    ok(json: unknown) {
      return {
        status: 200,
        body: {
          candidates: [
            {
              content: { role: 'model', parts: [{ text: JSON.stringify(json) }] },
              finishReason: 'STOP',
              index: 0,
            },
          ],
        },
      };
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
