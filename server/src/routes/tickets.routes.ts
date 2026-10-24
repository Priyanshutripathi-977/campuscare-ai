import { Router } from 'express';
import {
  AddUpdateSchema,
  AssignSchema,
  ClassificationSchema,
  CreateTicketSchema,
  ReopenSchema,
  StatusChangeSchema,
  TicketQuerySchema,
} from '@campuscare/shared';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import type { createLimiters } from '../middleware/rateLimit';
import {
  deleteStoredImage,
  imagePath,
  uploadSingleImage,
  validateAndStoreImage,
} from '../middleware/upload';
import * as tickets from '../services/ticket.service';
import { parse } from '../utils/validate';
import { HttpError } from '../utils/HttpError';

const TicketIdParam = z.object({
  ticketId: z.string().regex(/^CC-\d{4}-\d{6}$/, 'Invalid ticket id'),
});

export function ticketsRouter(limiters: ReturnType<typeof createLimiters>) {
  const router = Router();
  router.use(requireAuth);

  /**
   * Create a complaint. Sent as multipart/form-data:
   *   data  = JSON string matching CreateTicketSchema
   *   image = optional JPG/PNG/WebP file
   */
  router.post(
    '/',
    requireRole('student'),
    limiters.createTicket,
    uploadSingleImage,
    async (req, res) => {
      let json: unknown;
      try {
        json = JSON.parse(typeof req.body?.data === 'string' ? req.body.data : '');
      } catch {
        throw new HttpError(400, 'Complaint details are missing or not valid JSON');
      }
      const input = parse(CreateTicketSchema, json);

      const image = req.file ? await validateAndStoreImage(req.file) : null;
      try {
        const ticket = await tickets.createTicket(req.user!, input, image);
        res.status(201).json({ ticket });
      } catch (err) {
        if (image) await deleteStoredImage(image.filename); // don't leave orphan files behind
        throw err;
      }
    },
  );

  router.get('/', async (req, res) => {
    const query = parse(TicketQuerySchema, req.query);
    res.json(await tickets.listTickets(req.user!, query));
  });

  router.get('/:ticketId', async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    res.json({ ticket: await tickets.getTicketDetail(req.user!, ticketId) });
  });

  router.get('/:ticketId/image', async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    const image = await tickets.getTicketImage(req.user!, ticketId);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.type(image.mimeType).sendFile(imagePath(image.filename));
  });

  router.post('/:ticketId/updates', async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    const { message } = parse(AddUpdateSchema, req.body);
    res.status(201).json({ ticket: await tickets.addUpdate(req.user!, ticketId, message) });
  });

  router.patch('/:ticketId/status', requireRole('staff', 'admin'), async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    const { status, note } = parse(StatusChangeSchema, req.body);
    res.json({ ticket: await tickets.changeStatus(req.user!, ticketId, status, note) });
  });

  router.post('/:ticketId/reopen', requireRole('student'), async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    const { reason } = parse(ReopenSchema, req.body);
    res.json({ ticket: await tickets.reopenTicket(req.user!, ticketId, reason) });
  });

  router.patch('/:ticketId/classification', requireRole('admin'), async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    const { category, priority } = parse(ClassificationSchema, req.body);
    res.json({ ticket: await tickets.classifyTicket(req.user!, ticketId, category, priority) });
  });

  // Re-run the AI analysis (e.g. after editing the routing rules or adding a Gemini key).
  router.post('/:ticketId/reanalyze', requireRole('admin'), async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    res.json({ ticket: await tickets.rerunAnalysis(req.user!, ticketId) });
  });

  router.patch('/:ticketId/assign', requireRole('admin'), async (req, res) => {
    const { ticketId } = parse(TicketIdParam, req.params);
    const { departmentId, assignedTo, note } = parse(AssignSchema, req.body);
    res.json({
      ticket: await tickets.assignTicket(req.user!, ticketId, departmentId, assignedTo, note),
    });
  });

  return router;
}
