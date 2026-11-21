import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { NOTE_IMAGE_ID } from '@/lib/notes/markdown';
import { getCurrentUser } from '@/services/auth.service';
import { noteImageUrl } from '@/services/note-image.service';

/**
 * `GET /api/notes/images/<id>` shows one of the learner's note images.
 *
 * It answers with a redirect to a short-lived signed URL, so the bytes come
 * straight from the bucket and never pass through Cloud Run. The folder is
 * the session's uid, so an id from someone else's note finds nothing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!NOTE_IMAGE_ID.test(id)) {
    return NextResponse.json({ error: 'not_found', message: 'No such image' }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (user === null) {
    return NextResponse.json(
      { error: 'unauthenticated', message: 'Sign in to see your notes.' },
      { status: 401 },
    );
  }
  try {
    const url = await noteImageUrl(user.uid, id);
    return NextResponse.redirect(url, {
      status: 302,
      // Private: the URL is the learner's own. Shorter than the URL's lifetime.
      headers: { 'Cache-Control': 'private, max-age=900' },
    });
  } catch (error) {
    logger.error('Signing a note image failed', error, { uid: user.uid, id });
    return NextResponse.json(
      { error: 'unavailable', message: 'The image could not be loaded.' },
      { status: 503 },
    );
  }
}
