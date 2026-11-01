import { NextResponse } from 'next/server';
import { z } from 'zod';

import { COURSE_SLUGS } from '@/lib/course/courses';
import { courseRecord, trustedDay } from '@/lib/course/progress';
import { COURSE_RULES, courseXp } from '@/lib/course/rules';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { recordCompletion } from '@/services/progress.service';

/**
 * `POST /api/progress` — the caller marks an item of one course finished, or
 * takes the mark back. Each course keeps its own tracker, so the body names
 * the course. Finishing an item also enrolls the caller in that course.
 *
 * There is no uid in the body. The record to change is the session's, so a
 * learner can only ever change their own progress. The item id must exist in
 * that course's catalogue, and the XP comes from the catalogue, never from the
 * client.
 *
 * The client may send its local day so a late-night session counts for the
 * day the learner lives in. `trustedDay` accepts it only within one day of
 * the server's clock.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  course: z.enum(COURSE_SLUGS),
  itemId: z.string().min(1).max(160),
  done: z.boolean(),
  day: z.string().max(10).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch (error) {
      return NextResponse.json(
        {
          error: 'invalid_body',
          message: error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
        },
        { status: 400 },
      );
    }

    const day = trustedDay(body.day, new Date());
    const record = await recordCompletion(user, body.course, body.itemId, body.done, day);
    const tracker = courseRecord(record, body.course);
    return NextResponse.json({
      done: tracker.done[body.itemId] !== undefined,
      xpGained: body.done ? COURSE_RULES[body.course].xpForItem(body.itemId) : 0,
      totalXp: courseXp(body.course, tracker.done),
    });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Recording course progress failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
