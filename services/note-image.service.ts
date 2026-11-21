import 'server-only';

import { randomBytes } from 'node:crypto';

import { MAX_NOTE_IMAGE_BYTES } from '@/lib/notes/limits';
import { NOTE_IMAGE_ID } from '@/lib/notes/markdown';
import { buildObjectPath, UploadRejectedError } from '@/lib/storage-paths';
import { createSignedReadUrl, saveObject } from '@/services/storage.service';

/**
 * Images in chapter notes, kept in the app bucket at
 * `note-images/<uid>/<id>.jpg`.
 *
 * The browser shrinks every image to a JPEG of at most 1,600 px before it
 * sends it, so a file is a few hundred kilobytes. The server reads the bytes,
 * checks that they are a JPEG and writes them itself. That is one request, it
 * needs no CORS rule on the bucket, and nothing unchecked ever lands. See
 * ADR-0015.
 *
 * The note stores only the id. The uid comes from the session on every read,
 * so a learner can only ever load images from their own folder, whatever id
 * a note names.
 */

const FOLDER = 'note-images';

/** Long enough for a revision session; the image route signs a fresh one on every load. */
export const NOTE_IMAGE_URL_TTL_MS = 30 * 60 * 1000;

function objectPath(uid: string, id: string): string {
  if (!NOTE_IMAGE_ID.test(id)) throw new UploadRejectedError('That is not a note image id.');
  return buildObjectPath({ collection: FOLDER, docId: uid, filename: `${id}.jpg` });
}

/** True when the bytes start like a JPEG file (SOI marker, then another marker). */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Stores one note image for the learner and returns its new id.
 *
 * @throws {UploadRejectedError} when the bytes are empty, too large or not a JPEG.
 */
export async function saveNoteImage(uid: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength === 0) throw new UploadRejectedError('The image is empty.');
  if (bytes.byteLength > MAX_NOTE_IMAGE_BYTES) {
    throw new UploadRejectedError('That image is too large. Crop it or use a smaller one.');
  }
  if (!isJpeg(bytes)) throw new UploadRejectedError('Send the image as a JPEG.');
  // 18 random bytes: 24 URL-safe characters, never sequential, never guessable.
  const id = randomBytes(18).toString('base64url');
  await saveObject(objectPath(uid, id), bytes, 'image/jpeg');
  return id;
}

/** A short-lived URL for one of the learner's own note images. */
export async function noteImageUrl(uid: string, id: string): Promise<string> {
  return createSignedReadUrl(objectPath(uid, id), NOTE_IMAGE_URL_TTL_MS);
}
