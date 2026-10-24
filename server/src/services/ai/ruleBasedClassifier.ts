/**
 * Offline, keyword-based classifier used when Gemini is not configured or fails.
 * It is intentionally simple and transparent. Its confidence is capped at 0.6, so with
 * the default rules its results always go to an administrator for review.
 */
import {
  AiClassificationSchema,
  type AiClassification,
  type Category,
  type Priority,
} from '@campuscare/shared';
import type { ComplaintInput } from './types';

/** Keyword → weight. Multi-word phrases are matched as phrases. */
const CATEGORY_KEYWORDS: Record<Exclude<Category, 'Other'>, Record<string, number>> = {
  IT: {
    'wi-fi': 3,
    wifi: 3,
    internet: 3,
    network: 2,
    computer: 2,
    computers: 2,
    pc: 2,
    pcs: 2,
    laptop: 1,
    printer: 2,
    login: 2,
    portal: 2,
    password: 1,
    software: 2,
    server: 1,
    scanner: 2,
    'blue screen': 3,
    lan: 2,
    router: 2,
    email: 1,
    website: 1,
  },
  Electrical: {
    light: 2,
    lights: 2,
    'tube light': 3,
    bulb: 2,
    fan: 3,
    switch: 2,
    switchboard: 3,
    socket: 3,
    plug: 2,
    wiring: 3,
    wire: 2,
    spark: 4,
    sparking: 4,
    sparks: 4,
    power: 2,
    electricity: 3,
    'power cut': 3,
    shock: 3,
    mcb: 3,
    fuse: 3,
    ac: 1,
    'air conditioner': 2,
    inverter: 2,
    voltage: 2,
  },
  Plumbing: {
    water: 2,
    leak: 3,
    leaking: 3,
    leakage: 3,
    tap: 3,
    drip: 2,
    drips: 2,
    pipe: 3,
    drain: 3,
    drainage: 3,
    flush: 3,
    toilet: 2,
    sink: 2,
    cooler: 2,
    'water cooler': 3,
    tank: 2,
    overflow: 2,
    clogged: 3,
    blocked: 1,
    dripping: 2,
    seepage: 3,
  },
  Housekeeping: {
    dirty: 3,
    clean: 2,
    cleaned: 2,
    cleaning: 2,
    garbage: 3,
    trash: 3,
    dustbin: 3,
    dustbins: 3,
    waste: 2,
    smell: 1,
    stink: 2,
    cockroach: 3,
    cockroaches: 3,
    rats: 3,
    pests: 3,
    mosquito: 2,
    mosquitoes: 2,
    sweeping: 3,
    mopping: 3,
    litter: 3,
    filthy: 3,
    dust: 2,
  },
  'Classroom Facilities': {
    bench: 3,
    benches: 3,
    desk: 3,
    desks: 3,
    chair: 3,
    chairs: 3,
    whiteboard: 3,
    blackboard: 3,
    board: 1,
    projector: 2,
    screen: 1,
    podium: 3,
    classroom: 1,
    'lecture hall': 2,
    window: 1,
    door: 1,
    curtain: 2,
    mic: 2,
    microphone: 2,
    speaker: 1,
  },
  Security: {
    theft: 4,
    stolen: 4,
    steal: 3,
    lock: 3,
    locked: 1,
    gate: 2,
    intruder: 4,
    stranger: 3,
    strangers: 3,
    harassment: 4,
    unsafe: 3,
    guard: 2,
    cctv: 3,
    camera: 1,
    fight: 3,
    threat: 4,
    trespass: 4,
    'unknown people': 4,
    suspicious: 3,
  },
};

const CRITICAL_TERMS = [
  'fire',
  'smoke',
  'spark',
  'sparking',
  'sparks',
  'burning smell',
  'electric shock',
  'shock',
  'gas leak',
  'gas smell',
  'injured',
  'injury',
  'bleeding',
  'collapsed',
  'collapse',
  'intruder',
  'flooding',
  'exposed wire',
  'live wire',
  'fainted',
];
// Note: words like "urgent" are deliberately NOT used — students write them for every issue,
// so they say nothing about real impact (and are an easy way to game the priority).
const HIGH_TERMS = [
  'exam',
  'exams',
  'no water',
  'entire',
  'whole floor',
  'all students',
  'everyone',
  'hostel',
  'night',
  'unsafe',
  'theft',
  'stolen',
  'broken lock',
  'slippery',
  'could fall',
  'may fall',
  'not working at all',
  'harassment',
  'hygiene',
];
/** Water + any of these = risk of electrocution. */
const ELECTRICAL_FITTINGS = [
  'switchboard',
  'switch',
  'switches',
  'socket',
  'wiring',
  'wire',
  'mcb',
  'plug',
];
const WATER_TERMS = [
  'water',
  'leak',
  'leaking',
  'leakage',
  'dripping',
  'drips',
  'wet',
  'flooding',
  'seepage',
];
const LOW_TERMS = [
  'minor',
  'small',
  'slightly',
  'cosmetic',
  'paint',
  'loose',
  'squeaky',
  'sometimes',
];

const ROOM_PATTERN =
  /\b(?:room|rm|lab|lh|hall|class(?:room)?|block|floor)[\s\-#:]*([a-z]?\d{1,4}[a-z]?)\b/i;

function normalise(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9\-\s]/g, ' ')
    .replace(/\s+/g, ' ')} `;
}

function countTerm(haystack: string, term: string) {
  const needle = ` ${term} `;
  let count = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) count++;
  return count;
}

function firstSentence(text: string, maxWords = 30) {
  const sentence = text.trim().split(/(?<=[.!?])\s+/)[0] ?? text;
  const words = sentence.split(/\s+/);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : sentence;
}

export function classifyWithRules(input: ComplaintInput): AiClassification {
  const text = normalise(
    [input.title, input.title, input.description, ...(input.followUps ?? [])].join(' '),
  );

  // 1. Category: highest keyword score wins.
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([category, words]) => {
    let score = 0;
    const hits: string[] = [];
    for (const [word, weight] of Object.entries(words)) {
      const n = countTerm(text, word);
      if (n > 0) {
        score += weight * Math.min(n, 3);
        hits.push(word);
      }
    }
    return { category: category as Category, score, hits };
  });
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0]!;
  const second = scores[1]!;
  const matched = best.score >= 3;
  const category: Category = matched ? best.category : 'Other';

  // Confidence: how far ahead the winner is. Capped at 0.6 — rules are never "sure".
  const margin = best.score === 0 ? 0 : (best.score - second.score) / best.score;
  const confidence = matched ? Math.round(Math.min(0.6, 0.3 + margin * 0.3) * 100) / 100 : 0.2;

  // 2. Priority from danger / impact words.
  const critical = CRITICAL_TERMS.filter((t) => countTerm(text, t) > 0);
  const waterNearPower =
    WATER_TERMS.some((t) => countTerm(text, t) > 0) &&
    ELECTRICAL_FITTINGS.some((t) => countTerm(text, t) > 0);
  if (waterNearPower) critical.push('water near electrical fittings');
  const high = HIGH_TERMS.filter((t) => countTerm(text, t) > 0);
  const low = LOW_TERMS.filter((t) => countTerm(text, t) > 0);
  let priority: Priority = 'Medium';
  let priorityReason = 'No urgency indicators found; treated as a normal issue.';
  if (critical.length) {
    priority = 'Critical';
    priorityReason = `Mentions a possible danger to people (${critical.slice(0, 3).join(', ')}).`;
  } else if (high.length) {
    priority = 'High';
    priorityReason = `Suggests wide impact or a safety concern (${high.slice(0, 3).join(', ')}).`;
  } else if (low.length) {
    priority = 'Low';
    priorityReason = `Described as a minor issue (${low.slice(0, 3).join(', ')}).`;
  }

  // 3. Location: use what the student typed; try to spot a room number in the text.
  const roomMatch = [input.title, input.description, ...(input.followUps ?? [])].join(' ').match(ROOM_PATTERN);

  // 4. Vague complaints → ask for more information.
  const wordCount = input.description.trim().split(/\s+/).length;
  const needsClarification = !matched || wordCount < 8;

  const result = {
    category,
    priority,
    confidence,
    summary: firstSentence(input.description),
    extractedLocation: {
      building: input.location.building,
      room: input.location.room ?? roomMatch?.[0] ?? null,
    },
    keyDetails: [
      ...(matched ? [`Keywords: ${best.hits.slice(0, 4).join(', ')}`] : []),
      ...(critical.length ? ['Possible safety risk mentioned'] : []),
    ],
    categoryReason: matched
      ? `Keyword match for ${category} (${best.hits.slice(0, 4).join(', ')}).`
      : 'No category keywords matched clearly.',
    priorityReason,
    needsClarification,
    clarificationQuestion: needsClarification
      ? 'Could you describe the problem in a bit more detail — what exactly is broken or wrong, and where?'
      : null,
    safetyRisk: critical.length > 0,
  };
  // Even our own rules go through the same validation as the model.
  return AiClassificationSchema.parse(result);
}
