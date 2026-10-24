/**
 * Authentication (who are you?) and authorization (are you allowed?).
 *
 * After login the server stores a signed JWT in an httpOnly cookie. JavaScript in the
 * browser cannot read that cookie, which protects it from XSS theft. SameSite=Lax stops
 * other websites from sending it along with forged POST requests.
 */
import type { CookieOptions, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@campuscare/shared';
import { env, isProduction } from '../config/env';
import { UserModel } from '../models/User';
import { HttpError } from '../utils/HttpError';

export const AUTH_COOKIE = 'cc_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 1 day

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
};

export function setAuthCookie(res: Response, userId: string, role: Role) {
  const token = jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
    algorithm: 'HS256',
  });
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
}

/** Rejects the request with 401 unless a valid login cookie is present. Sets `req.user`. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string') throw new HttpError(401, 'Please log in to continue');

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }

  // Load the user fresh from the DB so deleted users / changed roles take effect immediately.
  const user = await UserModel.findById(payload.sub).lean();
  if (!user) throw new HttpError(401, 'Your session is no longer valid. Please log in again.');

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as Role,
    departmentId: user.department ? String(user.department) : null,
  };
  next();
};

/** Use after requireAuth: allows only the listed roles. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, 'You do not have permission to do this');
    }
    next();
  };
