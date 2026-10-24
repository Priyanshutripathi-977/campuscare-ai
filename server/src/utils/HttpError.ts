/**
 * An error that carries an HTTP status code.
 * Throw it anywhere in a route/service: `throw new HttpError(404, 'Ticket not found')`
 * and the central error handler turns it into a proper JSON response.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
