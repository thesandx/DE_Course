import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { saveNoteSchema } from '@/lib/notes/schema';
import { requireUser } from '@/services/auth.service';
import { saveNote } from '@/services/notes.service';

/**
 * `PUT /api/notes` saves the learner's note for one chapter.
 *
 * There is no uid in the path or the body. The notebook is the session's, so
 * a caller can only ever change their own notes. The answer says whether this
 * save was kept or a newer edit from another device was (see
 * `services/notes.service.ts`).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    let input: z.infer<typeof saveNoteSchema>;
    try {
      input = saveNoteSchema.parse(await request.json());
    } catch (error) {
      return NextResponse.json(
        {
          error: 'invalid_body',
          message: error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
        },
        { status: 400 },
      );
    }

    const result = await saveNote(user, input.key, input.markdown, input.editedAt, new Date());
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Saving a note failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
