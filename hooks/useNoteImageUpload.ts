'use client';

import { useCallback, useState } from 'react';

import { MAX_NOTE_IMAGE_BYTES, NOTE_IMAGE_MAX_SIDE } from '@/lib/notes/limits';

/** Images per pick, paste or drop. More is almost always a mistake. */
export const MAX_IMAGES_PER_ADD = 5;
const UPLOAD_TIMEOUT_MS = 30_000;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Shrinks an image to at most `side` pixels on its longest side and encodes
 * it as a JPEG. A 4 MB phone photo becomes a few hundred kilobytes.
 * Transparent pixels turn white, because JPEG has no alpha and black would
 * hide dark text in a screenshot.
 */
async function shrink(file: File, side: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('This browser cannot read images.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob === null ? reject(new Error('That image could not be read.')) : resolve(blob),
      'image/jpeg',
      quality,
    );
  });
}

async function toJpeg(file: File): Promise<Blob> {
  const first = await shrink(file, NOTE_IMAGE_MAX_SIDE, 0.85);
  if (first.size <= MAX_NOTE_IMAGE_BYTES) return first;
  // A huge, detailed image: one more, smaller try before giving up.
  const second = await shrink(file, 1_100, 0.7);
  if (second.size <= MAX_NOTE_IMAGE_BYTES) return second;
  throw new Error('That image is too large. Crop it or use a smaller one.');
}

/** A caption from the file name: "Screenshot 2026-11-21 at 10.02.png" → "Screenshot 2026-11-21 at 10.02". */
function captionFor(file: File): string {
  const stem = file.name.replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();
  return stem === '' || stem === 'image' ? 'Image' : stem.slice(0, 120);
}

export interface UploadedImage {
  id: string;
  alt: string;
}

export interface NoteImageUpload {
  /** True while images are being shrunk or sent. */
  busy: boolean;
  /** Why the last add failed, in words for the learner. `null` when it did not. */
  error: string | null;
  /** Shrinks and stores the images, and calls `onEach` as each one is ready. */
  upload: (files: readonly File[], onEach: (image: UploadedImage) => void) => Promise<void>;
  dismiss: () => void;
}

/**
 * Sends images for a chapter note to `POST /api/notes/images`, one at a time.
 *
 * Each file is shrunk to a JPEG in the browser first, so the request is small
 * and the server stores one format. The note keeps only the id the server
 * answers with. An image needs a connection: unlike the text of a note, it is
 * not kept on the device first.
 */
export function useNoteImageUpload(): NoteImageUpload {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: readonly File[], onEach: (image: UploadedImage) => void) => {
      const usable = files.filter((file) => ACCEPTED.includes(file.type));
      setError(null);
      if (usable.length === 0) {
        setError('Add a PNG, JPEG, WebP or GIF image.');
        return;
      }
      setBusy(true);
      try {
        for (const file of usable.slice(0, MAX_IMAGES_PER_ADD)) {
          const jpeg = await toJpeg(file);
          const response = await fetch('/api/notes/images', {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: jpeg,
            signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
          });
          if (!response.ok) {
            const body: unknown = await response.json().catch(() => null);
            throw new Error(
              response.status === 401
                ? 'Your session ended. Sign in again to add images.'
                : typeof body === 'object' && body !== null && 'message' in body
                  ? String(body.message)
                  : 'The image could not be saved. Try again.',
            );
          }
          const body: unknown = await response.json();
          if (
            typeof body !== 'object' ||
            body === null ||
            !('id' in body) ||
            typeof body.id !== 'string'
          ) {
            throw new Error('The image could not be saved. Try again.');
          }
          onEach({ id: body.id, alt: captionFor(file) });
        }
        if (usable.length > MAX_IMAGES_PER_ADD) {
          setError(`Add up to ${MAX_IMAGES_PER_ADD} images at a time. The rest were left out.`);
        } else if (usable.length < files.length) {
          setError('Some files were not images, so they were left out.');
        }
      } catch (caught) {
        setError(
          caught instanceof TypeError
            ? 'You look offline. Images need a connection; your text is safe.'
            : caught instanceof Error && caught.name === 'TimeoutError'
              ? 'The image took too long to send. Try again on a better connection.'
              : caught instanceof Error
                ? caught.message
                : 'The image could not be saved.',
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const dismiss = useCallback(() => setError(null), []);

  return { busy, error, upload, dismiss };
}
