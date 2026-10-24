import { Schema, model, type InferSchemaType } from 'mongoose';
import { CATEGORIES } from '@campuscare/shared';

/**
 * A campus department. `categories` is the configurable category → department
 * mapping used for routing (e.g. the Electrical department handles "Electrical").
 */
const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    contactEmail: { type: String, trim: true },
    categories: [{ type: String, enum: CATEGORIES }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type Department = InferSchemaType<typeof departmentSchema>;
export const DepartmentModel = model('Department', departmentSchema);
