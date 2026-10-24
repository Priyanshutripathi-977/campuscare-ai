import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * "Ticket X might be a duplicate of ticket Y" — created automatically, decided by an admin.
 * Suggestions never change, merge or close the tickets themselves.
 */
const duplicateSuggestionSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true }, // the newer complaint
    candidate: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true }, // the possible original
    score: { type: Number, required: true, min: 0, max: 1 },
    reasons: [{ type: String, maxlength: 120 }],
    status: { type: String, enum: ['pending', 'confirmed', 'dismissed'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    note: { type: String, maxlength: 300, default: null },
  },
  { timestamps: true },
);

// The same pair can only be suggested once.
duplicateSuggestionSchema.index({ ticket: 1, candidate: 1 }, { unique: true });
duplicateSuggestionSchema.index({ status: 1, createdAt: -1 });

export type DuplicateSuggestion = InferSchemaType<typeof duplicateSuggestionSchema>;
export const DuplicateSuggestionModel = model('DuplicateSuggestion', duplicateSuggestionSchema);
