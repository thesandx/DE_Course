'use client';

import { useCallback, useState } from 'react';

import { MAX_IMAGE_URL_CHARS, MAX_IMAGES_PER_MESSAGE } from '@/lib/assistant/chat';

/** The longest side of an image after shrinking. Enough to read a screenshot of code. */
const MAX_SIDE_PX = 1_600;
const JPEG_QUALITY = 0.85;

/** Types the browser decodes everywhere. A phone camera photo arrives as JPEG. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const IMAGE_ACCEPT = ACCEPTED.join(',');

/**
 * Shrinks an image to at most `MAX_SIDE_PX` on its longest side and encodes it
 * as a JPEG data URL. A 4 MB phone photo becomes about 300 KB, which keeps the
 * request small and the model's image tokens low. Transparent pixels turn
 * white, because JPEG has no alpha and black would hide dark text.
 */
async function shrink(file: File, side = MAX_SIDE_PX, quality = JPEG_QUALITY): Promise<string> {
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
  return canvas.toDataURL('image/jpeg', quality);
}

async function toDataUrl(file: File): Promise<string> {
  const first = await shrink(file);
  if (first.length <= MAX_IMAGE_URL_CHARS) return first;
  // A huge, detailed image: one more, smaller try before giving up.
  const second = await shrink(file, 1_100, 0.7);
  if (second.length <= MAX_IMAGE_URL_CHARS) return second;
  throw new Error('That image is too large. Crop it or use a smaller screenshot.');
}

export interface ImageAttachments {
  /** The attached images, as JPEG data URLs, in the order the learner added them. */
  images: string[];
  /** Why the last add failed, in words for the learner. `null` when it did not. */
  error: string | null;
  /** True while files are being shrunk. */
  busy: boolean;
  add: (files: Iterable<File>) => Promise<void>;
  remove: (index: number) => void;
  clear: () => void;
  /** Puts images back after a send failed, so the learner does not attach them again. */
  restore: (images: readonly string[]) => void;
}

/**
 * The images a learner attaches to a question for Pip: from the photo button,
 * a paste or a drop. Each file is shrunk in the browser before it is kept.
 * At most `MAX_IMAGES_PER_MESSAGE` per question; extra files are refused with
 * a message, not dropped silently.
 */
export function useImageAttachments(): ImageAttachments {
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = useCallback(
    async (files: Iterable<File>) => {
      const picked = [...files];
      if (picked.length === 0) return;
      setError(null);
      const room = MAX_IMAGES_PER_MESSAGE - images.length;
      if (room <= 0) {
        setError(`You can attach up to ${MAX_IMAGES_PER_MESSAGE} images to one question.`);
        return;
      }
      const usable = picked.filter((file) => ACCEPTED.includes(file.type));
      if (usable.length === 0) {
        setError('Attach a PNG, JPEG, WebP or GIF image.');
        return;
      }
      setBusy(true);
      try {
        const urls: string[] = [];
        for (const file of usable.slice(0, room)) urls.push(await toDataUrl(file));
        setImages((current) => [...current, ...urls].slice(0, MAX_IMAGES_PER_MESSAGE));
        if (usable.length > room) {
          setError(
            `Only ${MAX_IMAGES_PER_MESSAGE} images fit on one question. The rest were left out.`,
          );
        } else if (usable.length < picked.length) {
          setError('Some files were not images, so they were left out.');
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'That image could not be read.');
      } finally {
        setBusy(false);
      }
    },
    [images.length],
  );

  const remove = useCallback((index: number) => {
    setImages((current) => current.filter((_, position) => position !== index));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setImages([]);
    setError(null);
  }, []);

  const restore = useCallback((restored: readonly string[]) => {
    setImages([...restored].slice(0, MAX_IMAGES_PER_MESSAGE));
  }, []);

  return { images, error, busy, add, remove, clear, restore };
}
