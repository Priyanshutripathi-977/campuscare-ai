import { Schema, model, type InferSchemaType } from 'mongoose';

/** One global settings document (key: 'global'). Admin-editable in a later milestone. */
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
    autoRouteConfidence: { type: Number, default: 0.75, min: 0, max: 1 },
    duplicateThreshold: { type: Number, default: 0.6, min: 0, max: 1 },
    duplicateWindowDays: { type: Number, default: 30, min: 1 },
  },
  { timestamps: true },
);

export type Settings = InferSchemaType<typeof settingsSchema>;
export const SettingsModel = model('Settings', settingsSchema);

/** Returns the settings document, creating it with defaults the first time. */
export async function getSettings() {
  return SettingsModel.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
}
