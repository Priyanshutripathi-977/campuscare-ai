/**
 * The offline rule-based classifier against 20 labelled, varied complaints
 * (src/services/ai/evalComplaints.ts). Each case lists every acceptable answer.
 */
import { describe, expect, it } from 'vitest';
import { AiClassificationSchema } from '@campuscare/shared';
import { EVAL_COMPLAINTS } from '../src/services/ai/evalComplaints';
import { classifyWithRules } from '../src/services/ai/ruleBasedClassifier';

describe('rule-based classifier on the evaluation set', () => {
  it('has at least 15 varied examples', () => {
    expect(EVAL_COMPLAINTS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(EVAL_COMPLAINTS.flatMap((c) => c.categories)).size).toBe(7); // every category covered
  });

  it.each(EVAL_COMPLAINTS)('$id ($note)', (c) => {
    const r = classifyWithRules({
      title: c.title,
      description: c.description,
      location: { building: c.building, room: c.room },
    });
    expect(AiClassificationSchema.safeParse(r).success).toBe(true);
    expect(c.categories).toContain(r.category);
    expect(c.priorities).toContain(r.priority);
    if (c.vague) expect(r.needsClarification).toBe(true);
    // Rules are never "sure": with the default 0.75 threshold they always go to a human.
    expect(r.confidence).toBeLessThanOrEqual(0.6);
  });

  it('flags danger as a safety risk and Critical', () => {
    const r = classifyWithRules({
      title: 'Smoke from switchboard',
      description:
        'There is smoke and a burning smell coming from the switchboard in the corridor.',
      location: { building: 'Block A' },
    });
    expect(r).toMatchObject({ priority: 'Critical', safetyRisk: true });
  });

  it('is not pushed to a higher priority by words like "URGENT"', () => {
    const r = classifyWithRules({
      title: 'URGENT URGENT',
      description: 'URGENT!!! The bench in room 10 is slightly loose, a small issue.',
      location: { building: 'Block A' },
    });
    expect(r.priority).toBe('Low');
  });

  it('uses follow-up answers (e.g. after a clarification question)', () => {
    const r = classifyWithRules({
      title: 'Not working again',
      description: 'It stopped working again today, please fix it.',
      location: { building: 'Main Building' },
      followUps: ['It is the ceiling fan in room 210. It does not turn on at all.'],
    });
    expect(r.category).toBe('Electrical');
    expect(r.extractedLocation?.room).toMatch(/210/);
  });

  it('spots a room number in the text when the student left it blank', () => {
    const r = classifyWithRules({
      title: 'Fan broken',
      description: 'The fan in room 305 does not turn on at all since this morning.',
      location: { building: 'Main Building' },
    });
    expect(r.extractedLocation?.room).toMatch(/305/);
  });
});
