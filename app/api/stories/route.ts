import { NextResponse } from 'next/server';
import { z } from 'zod';

import { storyInputSchema } from '@/lib/course/story-bank';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { removeStory, saveStory } from '@/services/story.service';

/**
 * `PUT /api/stories` saves one story; `DELETE /api/stories?id=` removes one.
 *
 * There is no uid in the path or the body. The bank is the session's, so a
 * caller can only ever change their own stories.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
}

function failed(error: unknown, what: string): NextResponse {
  const mapped = mapHttpError(error);
  if (!mapped.exposeDetail) logger.error(what, error);
  return NextResponse.json(mapped.body, { status: mapped.status });
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    let input: z.infer<typeof storyInputSchema>;
    try {
      input = storyInputSchema.parse(await request.json());
    } catch (error) {
      return badRequest(
        error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
      );
    }

    const story = await saveStory(user, input, new Date());
    return NextResponse.json(story);
  } catch (error) {
    return failed(error, 'Saving a story failed');
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const id = z.uuid().safeParse(new URL(request.url).searchParams.get('id'));
    if (!id.success) return badRequest('Name the story to remove with ?id=<uuid>.');

    await removeStory(user, id.data);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return failed(error, 'Removing a story failed');
  }
}
