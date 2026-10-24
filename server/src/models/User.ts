import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ROLES } from '@campuscare/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false → the hash is never loaded unless a query explicitly asks for it.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'student' },
    department: { type: Schema.Types.ObjectId, ref: 'Department', default: null }, // staff only
    studentId: { type: String, trim: true, maxlength: 30 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
