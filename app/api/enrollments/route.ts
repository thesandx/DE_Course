import { NextResponse } from 'next/server';
import { z } from 'zod';

import { COURSE_SLUGS } from '@/lib/course/courses';
import { trustedDay } from '@/lib/course/progress';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { enroll } from '@/services/progress.service';

/**
 * `POST /api/enrollments` — the caller joins a course.
 *
 * There is no uid in the body: the enrollment is the session's. Only open
 * courses are accepted (`COURSE_SLUGS`), so a course that is not open yet cannot be
 * joined early. Joining twice is harmless and keeps the first day.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  course: z.enum(COURSE_SLUGS),
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

    const record = await enroll(user, body.course, trustedDay(body.day, new Date()));
    return NextResponse.json({ course: body.course, enrolled: record.enrolled[body.course] });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Recording a course enrollment failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
