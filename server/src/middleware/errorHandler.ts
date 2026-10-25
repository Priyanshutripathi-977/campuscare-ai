import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../utils/HttpError';
import { env, isProduction } from '../config/env';

/** Any request that reaches this point matched no route. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central error handler. Known errors (HttpError) return their message.
 * Unknown errors are logged on the server, but the client only gets a
 * generic message so we never leak stack traces or internals.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }

  // Upload problems (too large, too many files, unexpected field).
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Image is too large (max ${env.MAX_UPLOAD_MB} MB)`
        : 'Invalid upload. Attach at most one image in the "image" field.';
    res.status(400).json({ error: { message: msg, details: { fieldErrors: { image: msg } } } });
    return;
  }

  // Malformed JSON body sent by the client.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
    return;
  }

  // Other client mistakes reported by Express's body parser (body too large → 413,
  // unsupported encoding/charset → 415, …). These are the client's fault, not a server crash.
  if (err?.expose && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    const messages: Record<number, string> = {
      413: 'Request is too large',
      415: 'Unsupported request format',
    };
    res.status(err.status).json({ error: { message: messages[err.status] ?? 'Bad request' } });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      message: 'Something went wrong on our side. Please try again.',
      ...(isProduction ? {} : { debug: String(err?.message ?? err) }),
    },
  });
};
