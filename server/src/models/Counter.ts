import { Schema, model } from 'mongoose';

/** Stores running sequence numbers, e.g. { _id: 'ticket-2026', seq: 42 }. */
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const CounterModel = model('Counter', counterSchema);
