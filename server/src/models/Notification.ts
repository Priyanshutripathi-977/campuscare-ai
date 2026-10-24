import { Schema, model, type InferSchemaType } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'ticket_routed', // sent to a department (automatically or by an admin)
  'ticket_assigned', // a department / staff member received a ticket
  'status_changed',
  'ticket_reopened',
  'update_added',
  'clarification_requested',
  'duplicate_linked',
  'sent_back_for_review',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * An in-app notification. `email` records what REALLY happened with the email copy:
 * not_configured (no SMTP), pending, sent, or failed (with the error) — never assumed.
 */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, maxlength: 400 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    email: {
      status: {
        type: String,
        enum: ['not_configured', 'pending', 'sent', 'failed'],
        required: true,
      },
      error: { type: String, default: null, maxlength: 300 },
      sentAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export type Notification = InferSchemaType<typeof notificationSchema>;
export const NotificationModel = model('Notification', notificationSchema);
