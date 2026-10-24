/**
 * Image upload handling.
 *  1. multer keeps the upload in memory and enforces size + "one file only".
 *  2. We then check the file's real content ("magic bytes") — renaming virus.exe to
 *     photo.jpg does not fool this check.
 *  3. The file is saved with a random name, so user-chosen names never touch the disk.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { UPLOAD_ALLOWED_MIME_TYPES } from '@campuscare/shared';
import { env } from '../config/env';
import { HttpError } from '../utils/HttpError';

export const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 },
}).single('image');

export interface StoredImage {
  filename: string;
  mimeType: string;
  size: number;
}

export async function validateAndStoreImage(file: Express.Multer.File): Promise<StoredImage> {
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !(UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(detected.mime)) {
    throw new HttpError(400, 'Image must be a JPG, PNG or WebP file', {
      fieldErrors: { image: 'Image must be a JPG, PNG or WebP file' },
    });
  }

  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.${detected.ext}`;
  await fs.writeFile(path.join(env.UPLOAD_DIR, filename), file.buffer, { flag: 'wx' });
  return { filename, mimeType: detected.mime, size: file.size };
}

export async function deleteStoredImage(filename: string) {
  await fs.rm(path.join(env.UPLOAD_DIR, path.basename(filename)), { force: true });
}

export function imagePath(filename: string) {
  // basename() guarantees the path can never escape the upload folder.
  return path.join(env.UPLOAD_DIR, path.basename(filename));
}
