import { NextResponse } from 'next/server';

import { RateLimiter } from '@/lib/assistant/rate-limit';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { MAX_NOTE_IMAGE_BYTES } from '@/lib/notes/limits';
import { noteImageSrc } from '@/lib/notes/markdown';
import { UploadRejectedError } from '@/lib/storage-paths';
import { requireUser } from '@/services/auth.service';
import { saveNoteImage } from '@/services/note-image.service';

/**
 * `POST /api/notes/images` stores one image for the learner's notes.
 *
 * The body is the image itself, a JPEG the browser already shrank (see
 * `hooks/useNoteImageUpload.ts`). The answer is the image's id and the path
 * a note uses to show it. The folder is the session's uid, never a value
 * from the request.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 40 images in 10 minutes is a lot of pasting; more is a script. */
const limiter = new RateLimiter({ limit: 40, windowMs: 10 * 60 * 1000 });

function json(status: number, error: string, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error, message }, { status, ...(headers && { headers }) });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const type = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
    if (type !== 'image/jpeg') return json(415, 'unsupported_type', 'Send the image as a JPEG.');
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_NOTE_IMAGE_BYTES) {
      return json(413, 'too_large', 'That image is too large. Crop it or use a smaller one.');
    }

    const wait = limiter.take(user.uid, Date.now());
    if (wait > 0) {
      return json(
        429,
        'rate_limited',
        `You added a lot of images in a short time. Try again in ${Math.ceil(wait / 60)} min.`,
        { 'Retry-After': String(wait) },
      );
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    const id = await saveNoteImage(user.uid, bytes);
    logger.info('Note image saved', { uid: user.uid, id, bytes: bytes.byteLength });
    return NextResponse.json({ id, src: noteImageSrc(id) }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadRejectedError) return json(400, 'rejected', error.message);
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Saving a note image failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
