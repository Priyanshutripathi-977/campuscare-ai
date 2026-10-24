/**
 * Duplicate detection: compares a new complaint with recent OPEN complaints and stores
 * suggestions for an administrator. It never merges, closes or deletes anything.
 */
import type { Types } from 'mongoose';
import type { DuplicateSuggestionDTO, TicketDuplicatesDTO } from '@campuscare/shared';
import { TicketModel, type TicketDoc } from '../models/Ticket';
import { DuplicateSuggestionModel } from '../models/DuplicateSuggestion';
import { getSettings } from '../models/Settings';
import { HttpError } from '../utils/HttpError';
import { rankCandidates, type ComparableTicket } from './similarity';
import { toTicketSummary, type PopulatedTicket } from './ticket.dto';
import type { Actor } from './ticket.service';

const MAX_CANDIDATES = 300; // compare with at most this many recent tickets
const MAX_SUGGESTIONS = 3; // keep only the best matches per complaint

const toComparable = (t: PopulatedTicket): ComparableTicket => ({
  id: String(t._id),
  title: t.title,
  description: t.description,
  location: { building: t.location?.building ?? '', room: t.location?.room },
  category: t.category ?? null,
  studentId: String(t.student),
});

/** Finds likely duplicates of `ticket` and saves them as pending suggestions. Returns how many were saved. */
export async function detectDuplicates(ticket: TicketDoc): Promise<number> {
  const { duplicates } = await getSettings();
  const since = new Date(Date.now() - duplicates.windowDays * 86_400_000);

  const candidates = await TicketModel.find(
    // The possible original must be OLDER than this complaint (so a pair is never suggested twice).
    {
      _id: { $ne: ticket._id },
      status: { $ne: 'Resolved' },
      createdAt: { $gte: since, $lt: ticket.createdAt },
    },
    'title description location category student',
  )
    .sort({ createdAt: -1 })
    .limit(MAX_CANDIDATES)
    .lean();

  const matches = rankCandidates(toComparable(ticket.toObject()), candidates.map(toComparable))
    .filter((m) => m.score >= duplicates.threshold)
    .slice(0, MAX_SUGGESTIONS);

  for (const m of matches) {
    // Already suggested the other way round (e.g. created before this rule existed)? Skip.
    if (await DuplicateSuggestionModel.exists({ ticket: m.id, candidate: ticket._id })) continue;
    // upsert + $setOnInsert: re-running detection never duplicates or overwrites a decision.
    await DuplicateSuggestionModel.updateOne(
      { ticket: ticket._id, candidate: m.id },
      { $setOnInsert: { score: m.score, reasons: m.reasons, status: 'pending' } },
      { upsert: true },
    );
  }
  return matches.length;
}

const SUMMARY_POPULATE = { path: 'department', select: 'name' };

export async function listSuggestions(
  status: 'pending' | 'confirmed' | 'dismissed',
  page: number,
  limit: number,
) {
  const filter = { status };
  const [rows, total] = await Promise.all([
    DuplicateSuggestionModel.find(filter)
      .sort(status === 'pending' ? { score: -1, createdAt: -1 } : { reviewedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'ticket', populate: SUMMARY_POPULATE })
      .populate({ path: 'candidate', populate: SUMMARY_POPULATE })
      .populate({ path: 'reviewedBy', select: 'name' })
      .lean(),
    DuplicateSuggestionModel.countDocuments(filter),
  ]);

  const items: DuplicateSuggestionDTO[] = rows
    .filter((r) => r.ticket && r.candidate) // skip pairs whose ticket no longer exists
    .map((r) => {
      const reviewer = r.reviewedBy as unknown as { _id: Types.ObjectId; name: string } | null;
      return {
        id: String(r._id),
        score: r.score,
        reasons: r.reasons,
        status: r.status as DuplicateSuggestionDTO['status'],
        ticket: toTicketSummary(r.ticket as unknown as PopulatedTicket),
        candidate: toTicketSummary(r.candidate as unknown as PopulatedTicket),
        createdAt: new Date(r.createdAt).toISOString(),
        reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
        reviewedBy: reviewer ? { id: String(reviewer._id), name: reviewer.name } : null,
        note: r.note ?? null,
      };
    });
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Admin decision. "confirmed" links the newer ticket to the original — nothing else changes. */
export async function decideSuggestion(
  actor: Actor,
  id: string,
  decision: 'confirmed' | 'dismissed',
  note: string | undefined,
) {
  const suggestion = await DuplicateSuggestionModel.findById(id);
  if (!suggestion) throw new HttpError(404, 'Suggestion not found');
  if (suggestion.status !== 'pending')
    throw new HttpError(409, `This suggestion was already ${suggestion.status}`);

  const [ticket, original] = await Promise.all([
    TicketModel.findById(suggestion.ticket),
    TicketModel.findById(suggestion.candidate, 'ticketId duplicateOf'),
  ]);
  if (!ticket || !original) throw new HttpError(409, 'One of the tickets no longer exists');

  if (decision === 'confirmed') {
    if (ticket.duplicateOf)
      throw new HttpError(409, 'This ticket is already marked as a duplicate');
    if (original.duplicateOf && String(original.duplicateOf) === String(ticket._id)) {
      throw new HttpError(409, 'The other ticket is already marked as a duplicate of this one');
    }
  }

  const now = new Date();
  // Only a still-pending suggestion can be decided (protects against two admins clicking at once).
  const updated = await DuplicateSuggestionModel.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: decision, reviewedBy: actor.id, reviewedAt: now, note: note ?? null } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'This suggestion was just decided by someone else');

  if (decision === 'confirmed') {
    ticket.duplicateOf = original._id;
    // Tell the student (and staff) in the ticket conversation — the ticket stays open.
    ticket.updates.push({
      author: actor.id as unknown as Types.ObjectId,
      authorRole: 'admin',
      message: `This complaint has been linked as a duplicate of ${original.ticketId}. ${note ?? 'Both reports will be handled together.'}`,
      at: now,
    });
    await ticket.save();
  }
  return { id: String(updated._id), status: updated.status };
}

/** Duplicate info for the ticket page. Suggestions are admin-only (they reveal other tickets). */
export async function duplicatesForTicket(
  actor: Actor,
  t: PopulatedTicket,
): Promise<TicketDuplicatesDTO> {
  const original = t.duplicateOf
    ? await TicketModel.findById(t.duplicateOf, 'ticketId title').lean()
    : null;
  const duplicateOf = original
    ? actor.role === 'admin'
      ? { ticketId: original.ticketId, title: original.title }
      : { ticketId: original.ticketId }
    : null;

  if (actor.role !== 'admin') return { duplicateOf, suggestions: [] };

  const rows = await DuplicateSuggestionModel.find({
    $or: [{ ticket: t._id }, { candidate: t._id }],
  })
    .sort({ score: -1 })
    .populate({ path: 'ticket', select: 'ticketId title status' })
    .populate({ path: 'candidate', select: 'ticketId title status' })
    .lean();

  return {
    duplicateOf,
    suggestions: rows.flatMap((r) => {
      const other = (String((r.ticket as unknown as PopulatedTicket)?._id) === String(t._id)
        ? r.candidate
        : r.ticket) as unknown as PopulatedTicket | null;
      if (!other) return [];
      return [
        {
          id: String(r._id),
          score: r.score,
          reasons: r.reasons,
          status: r.status as 'pending',
          other: { ticketId: other.ticketId, title: other.title, status: other.status },
        },
      ];
    }),
  };
}
