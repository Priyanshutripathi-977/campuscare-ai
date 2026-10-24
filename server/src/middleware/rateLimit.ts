/**
 * Rate limits slow down brute-force password guessing and spam submissions.
 * Limits can be overridden (tests use this to check the limiter without waiting).
 */
import rateLimit from 'express-rate-limit';

export interface RateLimitConfig {
  global: number; // requests per 15 min per IP, whole API
  login: number; // login attempts per 15 min per IP
  register: number; // registrations per hour per IP
  createTicket: number; // complaints per hour per user
}

export const defaultRateLimits: RateLimitConfig = {
  global: 600,
  login: 10,
  register: 10,
  createTicket: 15,
};

const message = (text: string) => ({ error: { message: text } });

export function createLimiters(cfg: RateLimitConfig) {
  return {
    global: rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: cfg.global,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: message('Too many requests. Please slow down and try again shortly.'),
    }),
    login: rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: cfg.login,
      skipSuccessfulRequests: true, // only failed attempts count
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: message('Too many failed login attempts. Try again in 15 minutes.'),
    }),
    register: rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: cfg.register,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: message('Too many accounts created from this network. Try again later.'),
    }),
    createTicket: rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: cfg.createTicket,
      // Count per logged-in user (requireAuth runs first), so a shared campus IP is not punished.
      keyGenerator: (req) => req.user?.id ?? 'anonymous',
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: message('You have submitted many complaints recently. Please try again later.'),
    }),
  };
}
