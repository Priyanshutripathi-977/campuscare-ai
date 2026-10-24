import { CounterModel } from '../models/Counter';

/**
 * Generates a unique, human-friendly ticket ID such as "CC-2026-000042".
 * MongoDB's atomic $inc guarantees two simultaneous submissions never get the same number.
 */
export async function nextTicketId(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const counter = await CounterModel.findOneAndUpdate(
    { _id: `ticket-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `CC-${year}-${String(counter.seq).padStart(6, '0')}`;
}
