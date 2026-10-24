import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CATEGORIES, PRIORITIES, ROLES, STATUSES } from '@campuscare/shared';

const statusHistorySchema = new Schema(
  {
    from: { type: String, enum: [...STATUSES, null], default: null },
    to: { type: String, enum: STATUSES, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = system
    note: { type: String, maxlength: 500 },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const updateSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorRole: { type: String, enum: ROLES, required: true },
  message: { type: String, required: true, maxlength: 1000 },
  at: { type: Date, required: true, default: Date.now },
});

const ticketSchema = new Schema(
  {
    ticketId: { type: String, required: true, unique: true }, // e.g. CC-2026-000042
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    location: {
      building: { type: String, required: true, trim: true, maxlength: 80 },
      room: { type: String, trim: true, maxlength: 40 },
      details: { type: String, trim: true, maxlength: 200 },
    },
    studentCategory: { type: String, enum: [...CATEGORIES, null], default: null },
    // Final category/priority — null until classified (by an admin now, by AI in a later milestone).
    category: { type: String, enum: [...CATEGORIES, null], default: null },
    priority: { type: String, enum: [...PRIORITIES, null], default: null },
    priorityRank: { type: Number, default: 0 }, // for sorting: Critical=4 … Low=1, 0 = unknown
    classification: {
      type: new Schema(
        {
          source: { type: String, enum: ['admin', 'ai'], required: true },
          by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    status: { type: String, enum: STATUSES, required: true, default: 'Submitted' },
    department: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    image: {
      type: new Schema(
        {
          filename: { type: String, required: true },
          mimeType: { type: String, required: true },
          size: { type: Number, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    routing: {
      type: new Schema(
        {
          method: { type: String, enum: ['auto', 'manual', 'admin_review'], required: true },
          decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          reason: { type: String, required: true },
          decidedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    needsReview: { type: Boolean, default: true },
    reviewReasons: [{ type: String }],
    dueAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    statusHistory: [statusHistorySchema],
    updates: [updateSchema],
    isDemo: { type: Boolean, default: false }, // seeded demo data is clearly flagged
  },
  { timestamps: true },
);

ticketSchema.index({ status: 1, category: 1 });
ticketSchema.index({ department: 1, status: 1 });
ticketSchema.index({ student: 1, createdAt: -1 });
ticketSchema.index({ dueAt: 1 });

export type Ticket = InferSchemaType<typeof ticketSchema>;
export type TicketDoc = HydratedDocument<Ticket>;
export const TicketModel = model('Ticket', ticketSchema);
