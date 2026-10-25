import { Schema, model, type InferSchemaType } from 'mongoose';
import { CATEGORIES, type Priority, type RoutingRules } from '@campuscare/shared';

/** One global settings document (key: 'global'), editable by admins via /api/admin/settings. */
const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    // How many hours a ticket of each priority may stay open before it is "overdue".
    slaHours: {
      Critical: { type: Number, default: 4, min: 1 },
      High: { type: Number, default: 24, min: 1 },
      Medium: { type: Number, default: 72, min: 1 },
      Low: { type: Number, default: 168, min: 1 },
    },
    routing: {
      autoRouteConfidence: { type: Number, default: 0.75, min: 0.5, max: 1 },
      reviewCriticalPriority: { type: Boolean, default: true },
      reviewCategories: { type: [{ type: String, enum: CATEGORIES }], default: ['Other'] },
    },
    duplicateThreshold: { type: Number, default: 0.6, min: 0, max: 1 },
    duplicateWindowDays: { type: Number, default: 30, min: 1 },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;
export const SettingsModel = model('Settings', settingsSchema);

export const DEFAULT_SLA_HOURS: Record<Priority, number> = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168,
};
const DEFAULT_ROUTING: RoutingRules = {
  autoRouteConfidence: 0.75,
  reviewCriticalPriority: true,
  reviewCategories: ['Other'],
};

export interface AppSettings {
  slaHours: Record<Priority, number>;
  routing: RoutingRules;
}

/**
 * Returns the settings, creating the document the first time. Missing fields (e.g. from an
 * older version of the app) are filled with defaults so callers always get complete values.
 */
export async function getSettings(): Promise<AppSettings> {
  const doc = await SettingsModel.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
  return {
    slaHours: { ...DEFAULT_SLA_HOURS, ...(doc?.slaHours as Partial<Record<Priority, number>>) },
    routing: { ...DEFAULT_ROUTING, ...(doc?.routing as Partial<RoutingRules>) },
  };
}
