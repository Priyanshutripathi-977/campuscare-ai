/**
 * Dashboard statistics — computed live from the database with one aggregation
 * query. Only counts are returned, never student details.
 */
import { Types } from 'mongoose';
import { CATEGORIES, PRIORITIES, STATUSES, type StatsDTO } from '@campuscare/shared';
import { TicketModel } from '../models/Ticket';
import { DepartmentModel } from '../models/Department';
import { DuplicateSuggestionModel } from '../models/DuplicateSuggestion';
import { visibilityFilter, type Actor } from './ticket.service';

const DAYS = 14;

/** Mongoose doesn't auto-cast ids inside aggregate(), so convert string ids ourselves. */
function castFilter(filter: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filter)) {
    out[k] = typeof v === 'string' && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : v;
  }
  return out;
}

type Bucket = { _id: string | null; count: number };

function toRecord(buckets: Bucket[], keys: readonly string[], nullLabel: string) {
  const record: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const b of buckets) {
    const key = b._id ?? nullLabel;
    record[key] = (record[key] ?? 0) + b.count;
  }
  return record;
}

export async function getStats(actor: Actor, now = new Date()): Promise<StatsDTO> {
  const match = castFilter(visibilityFilter(actor));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (DAYS - 1));

  const [facets] = await TicketModel.aggregate<{
    byStatus: Bucket[];
    byCategory: Bucket[];
    byPriority: Bucket[];
    byDepartment: Bucket[];
    openByPriority: Bucket[];
    deptPerformance: {
      _id: unknown;
      open: number;
      resolved: number;
      overdue: number;
      avgMs: number | null;
    }[];
    overdue: { count: number }[];
    needsReview: { count: number }[];
    resolution: { avgMs: number | null }[];
    perDay: Bucket[];
  }>([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
        byDepartment: [{ $group: { _id: '$department', count: { $sum: 1 } } }],
        openByPriority: [
          { $match: { status: { $ne: 'Resolved' } } },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ],
        // Workload + speed per department (tickets not yet assigned are left out).
        deptPerformance: [
          { $match: { department: { $ne: null } } },
          {
            $group: {
              _id: '$department',
              open: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } },
              resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
              overdue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$status', 'Resolved'] },
                        { $gt: ['$dueAt', null] }, // has a deadline (dates sort above null)
                        { $lt: ['$dueAt', now] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // $avg ignores nulls, so only resolved tickets with a resolve time count.
              avgMs: {
                $avg: {
                  $cond: [
                    { $and: [{ $eq: ['$status', 'Resolved'] }, { $gt: ['$resolvedAt', null] }] },
                    { $subtract: ['$resolvedAt', '$createdAt'] },
                    null,
                  ],
                },
              },
            },
          },
        ],
        overdue: [
          { $match: { status: { $ne: 'Resolved' }, dueAt: { $ne: null, $lt: now } } },
          { $count: 'count' },
        ],
        needsReview: [{ $match: { needsReview: true } }, { $count: 'count' }],
        resolution: [
          { $match: { status: 'Resolved', resolvedAt: { $ne: null } } },
          { $group: { _id: null, avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } },
        ],
        perDay: [
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone } },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const byStatus = toRecord(facets!.byStatus, STATUSES, 'Unknown');
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const resolved = byStatus.Resolved ?? 0;

  // Department ids → names (null = not yet assigned).
  const deptIds = [
    ...facets!.byDepartment.map((b) => b._id),
    ...facets!.deptPerformance.map((d) => d._id),
  ].filter(Boolean);
  const depts = await DepartmentModel.find({ _id: { $in: deptIds } }, 'name').lean();
  const deptName = new Map(depts.map((d) => [String(d._id), d.name]));
  const byDepartment = facets!.byDepartment
    .map((b) => ({
      name: b._id ? (deptName.get(String(b._id)) ?? 'Unknown') : 'Unassigned',
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Fill in days with zero complaints so the trend chart has no gaps.
  const perDayMap = new Map(facets!.perDay.map((b) => [b._id, b.count]));
  const createdPerDay = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d); // YYYY-MM-DD
    return { date: key, count: perDayMap.get(key) ?? 0 };
  });

  const toHours = (ms: number | null | undefined) =>
    ms === null || ms === undefined ? null : Math.round((ms / 3600_000) * 10) / 10;
  const departmentPerformance = facets!.deptPerformance
    .map((d) => ({
      name: deptName.get(String(d._id)) ?? 'Unknown',
      open: d.open,
      resolved: d.resolved,
      overdue: d.overdue,
      avgResolutionHours: toHours(d.avgMs),
    }))
    .sort((a, b) => b.open + b.resolved - (a.open + a.resolved));

  const avgMs = facets!.resolution[0]?.avgMs ?? null;
  const pendingDuplicates =
    actor.role === 'admin'
      ? await DuplicateSuggestionModel.countDocuments({ status: 'pending' })
      : null;
  return {
    scope: actor.role === 'admin' ? 'all' : 'department',
    total,
    open: total - resolved,
    resolved,
    overdue: facets!.overdue[0]?.count ?? 0,
    needsReview: facets!.needsReview[0]?.count ?? 0,
    pendingDuplicates,
    avgResolutionHours: avgMs === null ? null : Math.round((avgMs / 3600_000) * 10) / 10,
    byStatus,
    byCategory: toRecord(facets!.byCategory, CATEGORIES, 'Unclassified'),
    byPriority: toRecord(facets!.byPriority, PRIORITIES, 'Unassessed'),
    byDepartment,
    openByPriority: toRecord(facets!.openByPriority, PRIORITIES, 'Unassessed'),
    departmentPerformance,
    createdPerDay,
  };
}
