/**
 * Routing policy — plain, deterministic code that decides what happens with an AI suggestion.
 * The AI never decides on its own: a ticket is auto-routed only when EVERY rule passes.
 * Rules come from the admin-editable settings + the department → category mapping.
 */
import type { Category, ReviewReason, RoutingRules } from '@campuscare/shared';
import type { AiResult } from './ai/types';

export interface DepartmentRef {
  id: string;
  name: string;
  categories: readonly Category[];
}

export interface RoutingDecision {
  autoRoute: boolean;
  /** Department the mapping recommends for the AI's category (even when not auto-routed). */
  recommendedDepartment: { id: string; name: string } | null;
  reviewReasons: ReviewReason[];
  /** Human-readable explanation stored on the ticket. */
  explanation: string;
}

export const DEFAULT_ROUTING_RULES: RoutingRules = {
  autoRouteConfidence: 0.75,
  reviewCriticalPriority: true,
  reviewCategories: ['Other'],
};

const REASON_TEXT: Record<ReviewReason, string> = {
  awaiting_classification: 'it has not been classified yet',
  ai_unavailable: 'the AI service was unavailable, so a simple keyword classifier was used',
  low_confidence: 'the AI was not confident enough',
  needs_clarification: 'the complaint needs more detail from the student',
  critical_priority: 'Critical issues are always confirmed by a person',
  review_category: 'this category is always reviewed by an administrator',
  no_department_for_category: 'no department is mapped to this category',
  student_category_mismatch: "the AI's category differs from the student's choice",
  sent_back_for_review: 'staff sent it back for review',
};

export function decideRouting({
  ai,
  studentCategory,
  rules,
  departments,
}: {
  ai: AiResult;
  studentCategory: Category | null | undefined;
  rules: RoutingRules;
  departments: DepartmentRef[];
}): RoutingDecision {
  const reasons: ReviewReason[] = [];
  const dept = departments.find((d) => d.categories.includes(ai.category)) ?? null;

  if (ai.source !== 'gemini') reasons.push('ai_unavailable');
  if (ai.confidence < rules.autoRouteConfidence) reasons.push('low_confidence');
  if (ai.needsClarification) reasons.push('needs_clarification');
  if (rules.reviewCriticalPriority && ai.priority === 'Critical') reasons.push('critical_priority');
  if (rules.reviewCategories.includes(ai.category)) reasons.push('review_category');
  if (!dept) reasons.push('no_department_for_category');
  if (studentCategory && studentCategory !== ai.category) reasons.push('student_category_mismatch');

  const pct = `${Math.round(ai.confidence * 100)}%`;
  const recommendedDepartment = dept ? { id: dept.id, name: dept.name } : null;

  if (reasons.length === 0) {
    return {
      autoRoute: true,
      recommendedDepartment,
      reviewReasons: [],
      explanation: `Automatically routed to ${dept!.name}: classified as ${ai.category} (${ai.priority}) with ${pct} confidence. ${ai.categoryReason}`,
    };
  }
  return {
    autoRoute: false,
    recommendedDepartment,
    reviewReasons: reasons,
    explanation: `Sent to an administrator because ${reasons.map((r) => REASON_TEXT[r]).join('; ')}. Suggested: ${ai.category} / ${ai.priority} (${pct} confidence)${dept ? ` → ${dept.name}` : ''}.`,
  };
}
