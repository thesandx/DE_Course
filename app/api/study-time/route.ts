import { NextResponse } from 'next/server';
import { z } from 'zod';

import { trustedDay } from '@/lib/course/progress';
import { MAX_SECONDS_PER_REPORT } from '@/lib/course/study-time';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { recordStudyTime } from '@/services/progress.service';

/**
 * `POST /api/study-time` — the browser reports seconds the caller spent on a
 * course page. The study streak map on the home page reads the totals.
 *
 * There is no uid in the body: the time is the session's. One report adds at
 * most `MAX_SECONDS_PER_REPORT`, and one day holds at most 24 hours, so a
 * caller can only ever inflate their own private map, and only within a day.
 *
 * The client sends its local day so a late-night session counts for the day
 * the learner lives in. `trustedDay` accepts it only within one day of the
 * server's clock.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  seconds: z.number().int().min(1).max(MAX_SECONDS_PER_REPORT),
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

    await recordStudyTime(user, trustedDay(body.day, new Date()), body.seconds);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Recording study time failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
