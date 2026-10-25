/**
 * Text + location similarity for duplicate detection. Pure functions, no database.
 *
 * Text similarity uses TF-IDF + cosine similarity:
 *  - TF  (term frequency): how often a word appears in this complaint.
 *  - IDF (inverse document frequency): words that appear in many complaints ("not",
 *    "working") count less than rare, specific words ("projector", "LH-5").
 *  - Cosine similarity: compares the two weighted word lists; 1 = same words, 0 = none shared.
 */

const STOPWORDS = new Set(
  'a an and are as at be been but by for from has have he her his i if in into is it its me my no not of on or our please so some that the their them there they this to was we were what when where which while who will with you your very since also just still again any can could should would get got been being do does did am about after before because here how than then too only all ever every one two other'.split(
    ' ',
  ),
);

/** Lowercase words, without stopwords, with simple plural/verb endings removed. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/wi-?fi/g, 'wifi')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** TF-IDF vectors for a small set of documents (IDF is smoothed so 2-document sets work). */
export function tfidfVectors(docs: string[][]): Map<string, number>[] {
  const df = new Map<string, number>();
  for (const doc of docs) for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  const n = docs.length;
  return docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [term, count] of tf) {
      const idf = Math.log((1 + n) / (1 + (df.get(term) ?? 0))) + 1;
      vec.set(term, (count / doc.length) * idf);
    }
    return vec;
  });
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, v] of a) {
    na += v * v;
    const w = b.get(t);
    if (w) dot += v * w;
  }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const normalisePlace = (s?: string | null) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function jaccard(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter);
}

export interface Place {
  building: string;
  room?: string | null;
}

/** 0–1. Same building counts most; same room adds certainty; unknown room is neutral. */
export function locationSimilarity(
  a: Place,
  b: Place,
): { score: number; sameBuilding: boolean; sameRoom: boolean; differentBuilding: boolean } {
  const ba = normalisePlace(a.building);
  const bb = normalisePlace(b.building);
  const building = ba && ba === bb ? 1 : jaccard(ba, bb);
  const ra = normalisePlace(a.room);
  const rb = normalisePlace(b.room);
  const room = ra && rb ? (ra === rb ? 1 : 0) : 0.5;
  return {
    score: 0.6 * building + 0.4 * room,
    sameBuilding: building === 1,
    sameRoom: Boolean(ra && ra === rb),
    differentBuilding: Boolean(ba && bb && building === 0),
  };
}

export interface ComparableTicket {
  id: string;
  title: string;
  description: string;
  location: Place;
  category: string | null;
  studentId: string;
}

export interface SimilarityResult {
  id: string;
  score: number;
  text: number;
  location: number;
  sameCategory: boolean;
  reasons: string[];
}

/** Weights: what the complaint says matters most, then where, then what kind of issue. */
export const WEIGHTS = { text: 0.55, location: 0.25, category: 0.2 };
/** The same kind of problem in a clearly different building is usually a separate problem. */
export const DIFFERENT_BUILDING_FACTOR = 0.7;

/** Words that name the place ("room", "101", "library") — removed before comparing text,
 *  so location is not counted twice (it has its own score). */
function placeWords(...places: Place[]): Set<string> {
  const words = new Set(['room', 'floor', 'block', 'building', 'hall', 'lab']);
  for (const p of places) for (const w of tokenize(`${p.building} ${p.room ?? ''}`)) words.add(w);
  return words;
}

/** Scores every candidate against `target`, highest first. */
export function rankCandidates(
  target: ComparableTicket,
  candidates: ComparableTicket[],
): SimilarityResult[] {
  if (candidates.length === 0) return [];
  const all = [target, ...candidates];
  const ignore = placeWords(...all.map((t) => t.location));
  const docs = all.map((t) =>
    tokenize(`${t.title} ${t.title} ${t.description}`).filter((w) => !ignore.has(w)),
  );
  const vectors = tfidfVectors(docs);
  const targetVec = vectors[0]!;

  return candidates
    .map((c, i) => {
      const text = cosine(targetVec, vectors[i + 1]!);
      const loc = locationSimilarity(target.location, c.location);
      const sameCategory = Boolean(target.category && target.category === c.category);
      let score =
        WEIGHTS.text * text +
        WEIGHTS.location * loc.score +
        WEIGHTS.category * (sameCategory ? 1 : 0);
      if (loc.differentBuilding) score *= DIFFERENT_BUILDING_FACTOR;

      const reasons = [`Description ${Math.round(text * 100)}% similar`];
      if (loc.sameRoom) reasons.push(`Same room (${c.location.room})`);
      else if (loc.sameBuilding) reasons.push(`Same building (${c.location.building})`);
      if (sameCategory) reasons.push(`Same category (${c.category})`);
      if (c.studentId === target.studentId) reasons.push('Reported by the same student');

      return {
        id: c.id,
        score: Math.round(score * 1000) / 1000,
        text,
        location: loc.score,
        sameCategory,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}
