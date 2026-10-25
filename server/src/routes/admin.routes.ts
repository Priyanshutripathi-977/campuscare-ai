import { Router } from 'express';
import { z } from 'zod';
import {
  DepartmentCategoriesSchema,
  DuplicateDecisionSchema,
  SettingsUpdateSchema,
  type Category,
  type DepartmentDTO,
  type SettingsDTO,
  type StaffDTO,
} from '@campuscare/shared';
import { requireAuth, requireRole } from '../middleware/auth';
import { DepartmentModel } from '../models/Department';
import { UserModel } from '../models/User';
import { getSettings, SettingsModel } from '../models/Settings';
import { getStats } from '../services/stats.service';
import { getAiProvider } from '../services/ai/provider';
import { getMailer } from '../services/mailer';
import { decideSuggestion, listSuggestions } from '../services/duplicate.service';
import { parse } from '../utils/validate';
import { HttpError } from '../utils/HttpError';

const toDepartmentDTO = (d: {
  _id: unknown;
  name: string;
  code: string;
  categories: unknown;
}): DepartmentDTO => ({
  id: String(d._id),
  name: d.name,
  code: d.code,
  categories: d.categories as Category[],
});

export function adminRouter() {
  const router = Router();
  router.use(requireAuth, requireRole('staff', 'admin'));

  // Admin sees campus-wide numbers; staff see their own department's numbers.
  router.get('/stats', async (req, res) => {
    res.json({ stats: await getStats(req.user!) });
  });

  router.get('/departments', async (_req, res) => {
    const depts = await DepartmentModel.find({ active: true }).sort({ name: 1 }).lean();
    res.json({ departments: depts.map(toDepartmentDTO) });
  });

  router.get('/staff', requireRole('admin'), async (req, res) => {
    const { department } = parse(
      z.object({
        department: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
      }),
      req.query,
    );
    const staff = await UserModel.find({ role: 'staff', ...(department ? { department } : {}) })
      .sort({ name: 1 })
      .populate({ path: 'department', select: 'name' })
      .lean();
    const out: StaffDTO[] = staff.map((s) => {
      const dept = s.department as unknown as { _id: unknown; name: string } | null;
      return {
        id: String(s._id),
        name: s.name,
        department: dept ? { id: String(dept._id), name: dept.name } : null,
      };
    });
    res.json({ staff: out });
  });

  // ----- Duplicate suggestions (admin only) -----

  router.get('/duplicates', requireRole('admin'), async (req, res) => {
    const q = parse(
      z.object({
        status: z.enum(['pending', 'confirmed', 'dismissed']).default('pending'),
        page: z.coerce.number().int().min(1).max(10_000).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10),
      }),
      req.query,
    );
    res.json(await listSuggestions(q.status, q.page, q.limit));
  });

  router.patch('/duplicates/:id', requireRole('admin'), async (req, res) => {
    const { id } = parse(
      z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') }),
      req.params,
    );
    const { decision, note } = parse(DuplicateDecisionSchema, req.body);
    res.json({ suggestion: await decideSuggestion(req.user!, id, decision, note) });
  });

  // ----- Configurable routing (admin only) -----

  /** Change which categories a department handles (the routing map). */
  router.patch('/departments/:id', requireRole('admin'), async (req, res) => {
    const { id } = parse(
      z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') }),
      req.params,
    );
    const { categories } = parse(DepartmentCategoriesSchema, req.body);
    const unique = [...new Set(categories)];

    // Each category may belong to only ONE active department, otherwise routing would be ambiguous.
    const conflict = await DepartmentModel.findOne({
      _id: { $ne: id },
      active: true,
      categories: { $in: unique },
    }).lean();
    if (conflict) {
      const clash = unique.filter((c) => (conflict.categories as string[]).includes(c));
      throw new HttpError(
        409,
        `${clash.join(', ')} is already handled by ${conflict.name}. Remove it there first.`,
      );
    }
    const dept = await DepartmentModel.findOneAndUpdate(
      { _id: id },
      { $set: { categories: unique } },
      { returnDocument: 'after' },
    ).lean();
    if (!dept) throw new HttpError(404, 'Department not found');
    res.json({ department: toDepartmentDTO(dept) });
  });

  router.get('/settings', requireRole('admin'), async (_req, res) => {
    const settings: SettingsDTO = await getSettings();
    res.json({
      settings,
      ai: {
        configured: getAiProvider() !== null,
        provider: getAiProvider()?.model ?? 'rule-based fallback',
      },
      // Only whether email is on — never the SMTP host, user or password.
      email: { configured: getMailer() !== null },
    });
  });

  router.patch('/settings', requireRole('admin'), async (req, res) => {
    const input = parse(SettingsUpdateSchema, req.body);
    await getSettings(); // make sure the document exists
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input.slaHours ?? {})) set[`slaHours.${k}`] = v;
    for (const [k, v] of Object.entries(input.routing ?? {})) set[`routing.${k}`] = v;
    for (const [k, v] of Object.entries(input.duplicates ?? {})) set[`duplicates.${k}`] = v;
    if (Object.keys(set).length === 0) throw new HttpError(400, 'Nothing to update');
    await SettingsModel.updateOne({ key: 'global' }, { $set: set }, { runValidators: true });
    const settings: SettingsDTO = await getSettings();
    res.json({ settings });
  });

  return router;
}
