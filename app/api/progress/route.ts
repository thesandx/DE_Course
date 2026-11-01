import { NextResponse } from 'next/server';
import { z } from 'zod';

import { totalXp, xpForItem } from '@/lib/course/catalog';
import { trustedDay } from '@/lib/course/progress';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { recordCompletion } from '@/services/progress.service';

/**
 * `POST /api/progress` — the caller marks a lesson or problem finished, or
 * takes the mark back.
 *
 * There is no uid in the body. The record to change is the session's, so a
 * learner can only ever change their own progress. The item id must exist in
 * the catalogue, and the XP comes from the catalogue, never from the client.
 *
 * The client may send its local day so a late-night session counts for the
 * day the learner lives in. `trustedDay` accepts it only within one day of
 * the server's clock.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
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
    const record = await recordCompletion(user, body.itemId, body.done, day);
    return NextResponse.json({
      done: record.done[body.itemId] !== undefined,
      xpGained: body.done ? xpForItem(body.itemId) : 0,
      totalXp: totalXp(record.done),
    });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Recording course progress failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
