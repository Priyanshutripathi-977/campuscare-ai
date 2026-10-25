import { describe, expect, it } from 'vitest';
import {
  decideRouting,
  DEFAULT_ROUTING_RULES,
  type DepartmentRef,
} from '../src/services/routing.service';
import type { AiResult } from '../src/services/ai/types';
import { goodAnswer } from './helpers/fakeAi';

const departments: DepartmentRef[] = [
  { id: 'd-elec', name: 'Electrical Maintenance', categories: ['Electrical'] },
  { id: 'd-it', name: 'IT Services', categories: ['IT'] },
  { id: 'd-admin', name: 'General Administration', categories: ['Other'] },
];
const ai = (o: Partial<AiResult> = {}): AiResult => ({
  ...goodAnswer(),
  source: 'gemini',
  model: 'm',
  valid: true,
  error: null,
  processedAt: new Date(),
  ...o,
});
const decide = (a: AiResult, extra: Partial<Parameters<typeof decideRouting>[0]> = {}) =>
  decideRouting({
    ai: a,
    studentCategory: null,
    rules: DEFAULT_ROUTING_RULES,
    departments,
    ...extra,
  });

describe('decideRouting', () => {
  it('auto-routes a confident, non-critical classification via the department map', () => {
    const d = decide(ai());
    expect(d).toMatchObject({
      autoRoute: true,
      recommendedDepartment: { id: 'd-elec' },
      reviewReasons: [],
    });
    expect(d.explanation).toMatch(/Electrical Maintenance.*92%/);
  });

  it.each<[string, Partial<AiResult>, Partial<Parameters<typeof decideRouting>[0]>, string]>([
    ['low confidence', { confidence: 0.6 }, {}, 'low_confidence'],
    [
      'needs clarification',
      { needsClarification: true, clarificationQuestion: 'Where?' },
      {},
      'needs_clarification',
    ],
    ['Critical priority', { priority: 'Critical' }, {}, 'critical_priority'],
    ['"Other" category', { category: 'Other' }, {}, 'review_category'],
    ['unmapped category', { category: 'Plumbing' }, {}, 'no_department_for_category'],
    ['fallback classifier', { source: 'fallback_rules' }, {}, 'ai_unavailable'],
    ['student disagrees', {}, { studentCategory: 'IT' }, 'student_category_mismatch'],
  ])('sends to review on %s', (_label, aiOverrides, extra, reason) => {
    const d = decide(ai(aiOverrides), extra);
    expect(d.autoRoute).toBe(false);
    expect(d.reviewReasons).toContain(reason);
  });

  it('respects configurable rules', () => {
    const relaxed = {
      autoRouteConfidence: 0.5,
      reviewCriticalPriority: false,
      reviewCategories: [],
    };
    expect(decide(ai({ confidence: 0.6 }), { rules: relaxed }).autoRoute).toBe(true);
    expect(decide(ai({ priority: 'Critical' }), { rules: relaxed }).autoRoute).toBe(true);
    expect(decide(ai({ category: 'Other' }), { rules: relaxed }).autoRoute).toBe(true);
    const strict = { ...DEFAULT_ROUTING_RULES, reviewCategories: ['Electrical' as const] };
    expect(decide(ai(), { rules: strict }).reviewReasons).toEqual(['review_category']);
  });

  it('still recommends a department when a human must decide', () => {
    const d = decide(ai({ priority: 'Critical' }));
    expect(d.recommendedDepartment?.name).toBe('Electrical Maintenance');
    expect(d.explanation).toMatch(/Critical issues are always confirmed by a person/);
  });
});
