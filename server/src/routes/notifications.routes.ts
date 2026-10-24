/** The logged-in user's own notifications. Nobody can read or change anyone else's. */
import { Router } from 'express';
import { z } from 'zod';
import type { NotificationDTO, NotificationListDTO } from '@campuscare/shared';
import { requireAuth } from '../middleware/auth';
import { NotificationModel } from '../models/Notification';
import { parse } from '../utils/validate';
import { HttpError } from '../utils/HttpError';

const ListQuery = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const IdParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });

export function notificationsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const q = parse(ListQuery, req.query);
    const mine = { user: req.user!.id };
    const filter = q.unread === 'true' ? { ...mine, read: false } : mine;
    const [rows, total, unreadCount] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate<{ ticket: { ticketId: string; title: string } | null }>(
          'ticket',
          'ticketId title',
        )
        .lean(),
      NotificationModel.countDocuments(filter),
      NotificationModel.countDocuments({ ...mine, read: false }),
    ]);
    const items: NotificationDTO[] = rows.map((n) => ({
      id: String(n._id),
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: new Date(n.createdAt).toISOString(),
      ticket: n.ticket ? { ticketId: n.ticket.ticketId, title: n.ticket.title } : null,
      email: {
        status: n.email?.status ?? 'not_configured',
        error: n.email?.error ?? null,
        sentAt: n.email?.sentAt ? new Date(n.email.sentAt).toISOString() : null,
      },
    }));
    const body: NotificationListDTO = {
      items,
      total,
      page: q.page,
      pages: Math.max(1, Math.ceil(total / q.limit)),
      unreadCount,
    };
    res.json(body);
  });

  router.patch('/:id/read', async (req, res) => {
    const { id } = parse(IdParam, req.params);
    // The user filter means another user's notification simply "does not exist" (404).
    const n = await NotificationModel.findOneAndUpdate(
      { _id: id, user: req.user!.id },
      { $set: { read: true, readAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!n) throw new HttpError(404, 'Notification not found');
    res.json({ id: String(n._id), read: true });
  });

  router.post('/read-all', async (req, res) => {
    const result = await NotificationModel.updateMany(
      { user: req.user!.id, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    res.json({ updated: result.modifiedCount });
  });

  return router;
}
