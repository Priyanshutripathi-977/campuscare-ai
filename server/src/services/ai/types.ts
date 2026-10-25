import type { AiClassification, Category } from '@campuscare/shared';

/** What we tell the AI about a complaint. Deliberately excludes the student's name/email. */
export interface ComplaintInput {
  title: string;
  description: string;
  location: { building: string; room?: string | null; details?: string | null };
  studentCategory?: Category | null;
  /** Extra information the student added later (e.g. answers to a clarification question). */
  followUps?: string[];
}

/** Anything that can turn a complaint into raw model text (Gemini, or a fake in tests). */
export interface AiProvider {
  name: 'gemini';
  model: string;
  /** Returns the model's raw text output. May throw (network, quota, timeout…). */
  generate(input: ComplaintInput, signal: AbortSignal): Promise<string>;
}

/** The final, validated result stored on the ticket. */
export interface AiResult extends AiClassification {
  source: 'gemini' | 'fallback_rules';
  model: string | null;
  /** Did the model output pass validation? (false = we fell back to rules) */
  valid: boolean;
  /** Why the AI provider failed, if it did (short, safe to show to admins). */
  error: string | null;
  processedAt: Date;
}
