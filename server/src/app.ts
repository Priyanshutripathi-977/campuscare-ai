/**
 * Builds the Express application (middleware + routes).
 * It is kept separate from index.ts so tests can import the app
 * without actually opening a network port.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { createLimiters, defaultRateLimits, type RateLimitConfig } from './middleware/rateLimit';
import { getDatabaseStatus } from './db/connect';
import { authRouter } from './routes/auth.routes';
import { ticketsRouter } from './routes/tickets.routes';
import { adminRouter } from './routes/admin.routes';
import { notificationsRouter } from './routes/notifications.routes';

export interface AppOptions {
  rateLimits?: Partial<RateLimitConfig>;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const limiters = createLimiters({ ...defaultRateLimits, ...options.rateLimits });

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // correct client IPs behind the Vite dev proxy
  app.use(helmet()); // secure HTTP headers
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true })); // only our frontend may call us
  app.use(express.json({ limit: '100kb' })); // parse JSON bodies, reject huge ones
  app.use(cookieParser());
  app.use('/api', limiters.global);

  // Reports live status. Returns 503 when the database is unavailable so that
  // monitoring tools (and our UI) can tell "server up but not usable".
  app.get('/api/health', (_req, res) => {
    const database = getDatabaseStatus();
    const healthy = database === 'connected';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      aiConfigured: Boolean(env.GEMINI_API_KEY),
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter(limiters));
  app.use('/api/tickets', ticketsRouter(limiters));
  app.use('/api/admin', adminRouter());
  app.use('/api/notifications', notificationsRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
