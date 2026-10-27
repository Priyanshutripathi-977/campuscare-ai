import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { LoginSchema, RegisterSchema, type UserDTO } from '@campuscare/shared';
import { UserModel } from '../models/User';
import { DepartmentModel } from '../models/Department';
import jwt from 'jsonwebtoken';
import {
  AUTH_COOKIE,
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  tokenVersionOf,
} from '../middleware/auth';
import { env } from '../config/env';
import type { createLimiters } from '../middleware/rateLimit';
import { parse } from '../utils/validate';
import { HttpError } from '../utils/HttpError';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing the same whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

async function toUserDTO(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  department?: unknown;
}): Promise<UserDTO> {
  const dept = user.department
    ? await DepartmentModel.findById(user.department, 'name').lean()
    : null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as UserDTO['role'],
    department: dept ? { id: String(dept._id), name: dept.name } : null,
  };
}

export function authRouter(limiters: ReturnType<typeof createLimiters>) {
  const router = Router();

  // Public sign-up is for students only; staff/admin accounts are created by an admin (or the seed).
  router.post('/register', limiters.register, async (req, res) => {
    const input = parse(RegisterSchema, req.body);
    if (await UserModel.exists({ email: input.email })) {
      throw new HttpError(409, 'An account with this email already exists', {
        fieldErrors: { email: 'An account with this email already exists' },
      });
    }
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      role: 'student',
      studentId: input.studentId,
    });
    setAuthCookie(res, String(user._id), 'student', 0);
    res.status(201).json({ user: await toUserDTO(user) });
  });

  router.post('/login', limiters.login, async (req, res) => {
    const input = parse(LoginSchema, req.body);
    const user = await UserModel.findOne({ email: input.email }).select('+passwordHash').lean();
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    // Same message for "no such email" and "wrong password" so attackers can't probe emails.
    if (!user || !ok) throw new HttpError(401, 'Incorrect email or password');
    setAuthCookie(res, String(user._id), user.role as UserDTO['role'], tokenVersionOf(user));
    res.json({ user: await toUserDTO(user) });
  });

  // Logout revokes the token on the server too: increasing the user's token version makes every
  // token issued before now invalid (so a copied cookie stops working). This signs the account
  // out on all devices. Always succeeds, even without a valid cookie.
  router.post('/logout', async (req, res) => {
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    if (typeof token === 'string') {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET, {
          algorithms: ['HS256'],
        }) as jwt.JwtPayload;
        await UserModel.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
      } catch {
        // invalid/expired token: nothing to revoke
      }
    }
    clearAuthCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await UserModel.findById(req.user!.id).lean();
    if (!user) throw new HttpError(401, 'Please log in to continue');
    res.json({ user: await toUserDTO(user) });
  });

  return router;
}
