import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { noteKeySchema, saveHighlightsSchema } from '@/lib/notes/schema';
import { requireUser } from '@/services/auth.service';
import { getHighlights, saveHighlights } from '@/services/highlights.service';

/**
 * The learner's highlights on the course text of one chapter.
 *
 * `GET /api/notes/highlights?key=…` reads them; `PUT` saves the whole list.
 * Both need a session, and there is no uid in the path or the body: the
 * highlights are the session's own. See `services/highlights.service.ts`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function invalid(message: string): NextResponse {
  return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const key = noteKeySchema.safeParse(new URL(request.url).searchParams.get('key'));
    if (!key.success) return invalid('Name a chapter that takes notes.');
    const stored = await getHighlights(user.uid, key.data);
    return NextResponse.json({ highlights: stored });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Reading highlights failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    let input: z.infer<typeof saveHighlightsSchema>;
    try {
      input = saveHighlightsSchema.parse(await request.json());
    } catch (error) {
      return invalid(
        error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
      );
    }

    const result = await saveHighlights(user, input.key, input.items, input.editedAt, new Date());
    logger.info('Highlights saved', {
      uid: user.uid,
      key: input.key,
      count: input.items.length,
      kept: result.kept,
    });
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Saving highlights failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
