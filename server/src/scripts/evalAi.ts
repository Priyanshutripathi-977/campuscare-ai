/**
 * Measures the configured AI on the labelled complaint set.
 *   npm run ai:eval -w server
 * Uses Gemini if GEMINI_API_KEY is set (this makes ~20 real API calls), otherwise the
 * rule-based fallback. Prints one line per complaint and an accuracy summary.
 */
import { env } from '../config/env';
import { createGeminiProvider } from '../services/ai/geminiProvider';
import { understandComplaint } from '../services/ai/complaintUnderstanding';
import { EVAL_COMPLAINTS } from '../services/ai/evalComplaints';

async function main() {
  const provider = env.GEMINI_API_KEY
    ? createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL })
    : null;
  console.log(
    `Evaluating: ${provider ? `Gemini (${provider.model})` : 'rule-based fallback (no GEMINI_API_KEY)'}\n`,
  );

  let cat = 0,
    pri = 0,
    clar = 0,
    vagueTotal = 0,
    failures = 0;
  for (const c of EVAL_COMPLAINTS) {
    const r = await understandComplaint(
      {
        title: c.title,
        description: c.description,
        location: { building: c.building, room: c.room },
      },
      provider,
      { timeoutMs: env.AI_TIMEOUT_MS, log: () => {} },
    );
    const okCat = c.categories.includes(r.category);
    const okPri = c.priorities.includes(r.priority);
    if (okCat) cat++;
    if (okPri) pri++;
    if (c.vague) {
      vagueTotal++;
      if (r.needsClarification) clar++;
    }
    if (provider && r.source !== 'gemini') failures++;
    const mark = okCat && okPri ? '✅' : '❌';
    console.log(
      `${mark} ${c.id.padEnd(26)} ${r.category.padEnd(20)} ${r.priority.padEnd(8)} conf ${r.confidence.toFixed(2)}` +
        `${r.needsClarification ? ' (asks for details)' : ''}${r.error && provider ? `  ⚠ ${r.error}` : ''}`,
    );
  }
  const n = EVAL_COMPLAINTS.length;
  console.log(`\nCategory accuracy: ${cat}/${n} (${Math.round((cat / n) * 100)}%)`);
  console.log(`Priority accuracy: ${pri}/${n} (${Math.round((pri / n) * 100)}%)`);
  console.log(`Vague complaints flagged for clarification: ${clar}/${vagueTotal}`);
  if (provider)
    console.log(`Calls that fell back to rules (errors/invalid output): ${failures}/${n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
