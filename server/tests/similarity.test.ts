import { describe, expect, it } from 'vitest';
import {
  cosine,
  locationSimilarity,
  rankCandidates,
  tfidfVectors,
  tokenize,
} from '../src/services/similarity';

type T = Parameters<typeof rankCandidates>[0];
const t = (
  id: string,
  title: string,
  description: string,
  building: string,
  room: string | null,
  category: string | null,
  studentId = 's1',
): T => ({
  id,
  title,
  description,
  location: { building, room },
  category,
  studentId,
});
const THRESHOLD = 0.6; // default setting

describe('text helpers', () => {
  it('tokenizes: lowercase, no stopwords, simple stemming, wi-fi normalised', () => {
    expect(tokenize('The Wi-Fi is NOT working in the labs')).toEqual(['wifi', 'work', 'lab']);
  });
  it('cosine similarity is 1 for identical and 0 for unrelated texts', () => {
    const [a, b, c] = tfidfVectors([
      ['fan', 'broken'],
      ['fan', 'broken'],
      ['water', 'leak'],
    ]);
    expect(cosine(a!, b!)).toBeCloseTo(1);
    expect(cosine(a!, c!)).toBe(0);
  });
  it('location: same room > same building > different building', () => {
    const same = locationSimilarity(
      { building: 'Main Building', room: '101' },
      { building: 'main building', room: '101' },
    );
    const bldg = locationSimilarity(
      { building: 'Main Building', room: '101' },
      { building: 'Main Building', room: '204' },
    );
    const diff = locationSimilarity({ building: 'Main Building' }, { building: 'Canteen' });
    expect(same.score).toBe(1);
    expect(bldg.score).toBeCloseTo(0.6);
    expect(diff.differentBuilding).toBe(true);
  });
});

describe('duplicate scoring on realistic pairs', () => {
  const duplicates: [string, T, T][] = [
    [
      'same fan, different words',
      t(
        'a',
        'Fan not working in room 101',
        'The ceiling fan in room 101 stopped working yesterday and it is very hot.',
        'Main Building',
        '101',
        'Electrical',
      ),
      t(
        'b',
        'Ceiling fan broken - 101',
        'Fan in classroom 101 does not turn on at all since yesterday.',
        'Main Building',
        '101',
        'Electrical',
        's2',
      ),
    ],
    [
      'wifi reported twice',
      t(
        'a',
        'Wi-Fi down in library',
        'The library WiFi keeps disconnecting on the first floor.',
        'Central Library',
        'Reading Hall 1',
        'IT',
      ),
      t(
        'b',
        'Library wifi not working',
        'No internet in the library reading hall, wifi disconnects every few minutes.',
        'Central Library',
        null,
        'IT',
        's2',
      ),
    ],
    [
      'student resubmits',
      t(
        'a',
        'Leaking tap in hostel washroom',
        'The tap in the second floor washroom is leaking continuously.',
        'Boys Hostel B',
        '2nd floor washroom',
        'Plumbing',
      ),
      t(
        'b',
        'Leaking tap hostel washroom again',
        'Tap leaking continuously in the 2nd floor washroom of hostel B.',
        'Boys Hostel B',
        '2nd floor washroom',
        'Plumbing',
      ),
    ],
  ];
  const notDuplicates: [string, T, T][] = [
    [
      'same room, different problem',
      t(
        'a',
        'Fan not working in room 101',
        'The ceiling fan in room 101 stopped working yesterday.',
        'Main Building',
        '101',
        'Electrical',
      ),
      t(
        'b',
        'Tube lights off in 101',
        'Two tube lights in room 101 are not working.',
        'Main Building',
        '101',
        'Electrical',
        's2',
      ),
    ],
    [
      'same problem, other building',
      t(
        'a',
        'Projector flickering',
        'The projector in LH-5 flickers during lectures.',
        'Lecture Hall Complex',
        'LH-5',
        'Classroom Facilities',
      ),
      t(
        'b',
        'Projector flickering',
        'The projector flickers during lectures in seminar room.',
        'Admin Block',
        'Seminar Hall',
        'Classroom Facilities',
        's2',
      ),
    ],
    [
      'unrelated, same building',
      t(
        'a',
        'Dirty washroom',
        'Washroom on ground floor not cleaned for two days.',
        'Main Building',
        'Ground floor',
        'Housekeeping',
      ),
      t(
        'b',
        'Bench broken',
        'Broken bench in room 108 with loose screws.',
        'Main Building',
        '108',
        'Classroom Facilities',
        's2',
      ),
    ],
  ];

  it.each(duplicates)('flags: %s', (_l, a, b) => {
    expect(rankCandidates(a, [b])[0]!.score).toBeGreaterThanOrEqual(THRESHOLD);
  });
  it.each(notDuplicates)('does not flag: %s', (_l, a, b) => {
    expect(rankCandidates(a, [b])[0]!.score).toBeLessThan(THRESHOLD);
  });

  it('explains its reasoning and ranks the best match first', () => {
    const [a, b] = duplicates[0]!.slice(1) as [T, T];
    const unrelated = notDuplicates[2]![2];
    const ranked = rankCandidates(a, [unrelated, b]);
    expect(ranked[0]!.id).toBe('b');
    expect(ranked[0]!.reasons).toEqual(
      expect.arrayContaining(['Same room (101)', 'Same category (Electrical)']),
    );
  });
});
