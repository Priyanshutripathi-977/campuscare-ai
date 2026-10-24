/**
 * The AI "complaint understanding" contract.
 *
 * The model is asked to return JSON in this shape, but the server NEVER trusts it:
 * every response is validated with AiClassificationSchema below (allowed values,
 * lengths, ranges). Anything that fails is treated as an AI failure.
 */
import { z } from 'zod';
import { CATEGORIES, PRIORITIES } from './constants';

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const AiClassificationSchema = z
  .object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    /** 0 = pure guess, 1 = certain. */
    confidence: z.number().min(0).max(1),
    summary: shortText(240),
    extractedLocation: z
      .object({
        building: z.string().trim().max(80).nullish(),
        room: z.string().trim().max(40).nullish(),
      })
      .nullish(),
    keyDetails: z.array(shortText(160)).max(5).default([]),
    categoryReason: shortText(300),
    priorityReason: shortText(300),
    /** True when the complaint is too vague to act on. */
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().trim().max(240).nullish(),
    /** True if there is any risk to people's safety (fire, electric shock, injury, intruder…). */
    safetyRisk: z.boolean().default(false),
  })
  // Unknown extra keys are dropped (zod's default "strip"), so the model cannot smuggle fields in.
  .superRefine((v, ctx) => {
    if (v.needsClarification && !v.clarificationQuestion) {
      ctx.addIssue({
        code: 'custom',
        path: ['clarificationQuestion'],
        message: 'A clarification question is required when needsClarification is true',
      });
    }
  });

export type AiClassification = z.output<typeof AiClassificationSchema>;

/** Why a ticket was (or wasn't) routed automatically — stored on the ticket for transparency. */
export const REVIEW_REASONS = [
  'awaiting_classification',
  'ai_unavailable',
  'low_confidence',
  'needs_clarification',
  'critical_priority',
  'review_category',
  'no_department_for_category',
  'student_category_mismatch',
  'sent_back_for_review',
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

/** Admin-editable routing rules (stored in the settings document). */
export const RoutingRulesSchema = z.object({
  /** Minimum AI confidence (0–1) for automatic routing. */
  autoRouteConfidence: z.number().min(0.5).max(1),
  /** If true, Critical tickets always wait for a human, even when the AI is confident. */
  reviewCriticalPriority: z.boolean(),
  /** Categories that always go to an administrator (e.g. "Other"). */
  reviewCategories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
});
export type RoutingRules = z.output<typeof RoutingRulesSchema>;

/** Admin-editable duplicate-detection settings. */
export const DuplicateRulesSchema = z.object({
  /** Minimum similarity score (0–1) for a pair to be suggested as duplicates. */
  threshold: z.number().min(0.3).max(0.95),
  /** Only compare with open tickets created in the last N days. */
  windowDays: z.number().int().min(1).max(180),
});
export type DuplicateRules = z.output<typeof DuplicateRulesSchema>;

export const DuplicateDecisionSchema = z.object({
  decision: z.enum(['confirmed', 'dismissed']),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const SettingsUpdateSchema = z
  .object({
    slaHours: z
      .object(
        Object.fromEntries(
          PRIORITIES.map((p) => [
            p,
            z
              .number()
              .int()
              .min(1)
              .max(24 * 60),
          ]),
        ) as Record<(typeof PRIORITIES)[number], z.ZodNumber>,
      )
      .partial()
      .optional(),
    routing: RoutingRulesSchema.partial().optional(),
    duplicates: DuplicateRulesSchema.partial().optional(),
  })
  .strict();
export type SettingsUpdateInput = z.input<typeof SettingsUpdateSchema>;

export const DepartmentCategoriesSchema = z.object({
  categories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
});
