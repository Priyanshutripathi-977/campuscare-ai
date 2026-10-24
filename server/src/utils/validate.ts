import type { z } from 'zod';
import { fieldErrors } from '@campuscare/shared';
import { HttpError } from './HttpError';

/**
 * Validates `data` against a zod schema. On failure throws a 400 error whose
 * `details.fieldErrors` tells the client exactly which field is wrong.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Some fields are invalid', {
      fieldErrors: fieldErrors(result.error),
    });
  }
  return result.data;
}
