import { Router } from 'express';
import { z } from 'zod';
import type { DepartmentDTO, StaffDTO } from '@campuscare/shared';
import { requireAuth, requireRole } from '../middleware/auth';
import { DepartmentModel } from '../models/Department';
import { UserModel } from '../models/User';
import { getStats } from '../services/stats.service';
import { parse } from '../utils/validate';

export function adminRouter() {
  const router = Router();
  router.use(requireAuth, requireRole('staff', 'admin'));

  // Admin sees campus-wide numbers; staff see their own department's numbers.
  router.get('/stats', async (req, res) => {
    res.json({ stats: await getStats(req.user!) });
  });

  router.get('/departments', async (_req, res) => {
    const depts = await DepartmentModel.find({ active: true }).sort({ name: 1 }).lean();
    const out: DepartmentDTO[] = depts.map((d) => ({
      id: String(d._id),
      name: d.name,
      code: d.code,
      categories: d.categories as DepartmentDTO['categories'],
    }));
    res.json({ departments: out });
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

  return router;
}
