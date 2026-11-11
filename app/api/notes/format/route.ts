import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MODEL_FAILURES } from '@/lib/assistant/failures';
import { RateLimiter } from '@/lib/assistant/rate-limit';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { buildFormatMessages } from '@/lib/notes/format';
import { formatNoteSchema } from '@/lib/notes/schema';
import { noteTarget } from '@/lib/notes/targets';
import { requireUser } from '@/services/auth.service';
import { AssistantError, streamAnswer } from '@/services/openrouter.service';

/**
 * `POST /api/notes/format` asks Pip to format a note, and streams the
 * formatted note back as plain UTF-8 text.
 *
 * The body carries the note itself, not a key to read it by: the browser's
 * copy can be newer than the stored one while the learner is offline or
 * typing. The answer changes nothing on the server. The browser shows it,
 * and the learner chooses whether to use it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 12 formats in 10 minutes. A format is a long answer, so the brake is tighter than for questions. */
const limiter = new RateLimiter({ limit: 12, windowMs: 10 * 60 * 1000 });

/** A long note needs a long answer. About 4,500 words, so a full note fits. */
const FORMAT_MAX_TOKENS = 6_000;
const FORMAT_TIMEOUT_MS = 150_000;

function json(status: number, error: string, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error, message }, { status, ...(headers && { headers }) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();

    let input: z.infer<typeof formatNoteSchema>;
    try {
      input = formatNoteSchema.parse(await request.json());
    } catch (error) {
      return json(
        400,
        'invalid_body',
        error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
      );
    }

    const target = noteTarget(input.key);
    if (target === undefined) return json(400, 'unknown_chapter', 'That page does not take notes.');

    const wait = limiter.take(user.uid, Date.now());
    if (wait > 0) {
      return json(
        429,
        'rate_limited',
        `You formatted a lot of notes in a short time. Try again in ${Math.ceil(wait / 60)} min.`,
        { 'Retry-After': String(wait) },
      );
    }

    const stream = await streamAnswer(
      input.model,
      buildFormatMessages(target, input.markdown, input.mode, input.instruction),
      request.signal,
      false,
      { maxTokens: FORMAT_MAX_TOKENS, timeoutMs: FORMAT_TIMEOUT_MS },
    );
    logger.info('Note format', {
      uid: user.uid,
      model: input.model,
      key: input.key,
      mode: input.mode,
      chars: input.markdown.length,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof AssistantError) {
      logger.warn('Pip could not format a note', { reason: error.reason, detail: error.message });
      const failure = MODEL_FAILURES[error.reason];
      return json(failure.status, error.reason, failure.message);
    }
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Formatting a note failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
