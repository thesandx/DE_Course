import { NextResponse } from 'next/server';
import { z } from 'zod';

import { askSchema, buildModelMessages } from '@/lib/assistant/chat';
import { contextForPath } from '@/lib/assistant/context';
import { ASSISTANT_RATE_LIMIT, RateLimiter } from '@/lib/assistant/rate-limit';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { AssistantError, type AssistantFailure, streamAnswer } from '@/services/openrouter.service';

/**
 * `POST /api/assistant` answers a learner's doubt about the page they are on.
 *
 * Signed-in learners only: every answer costs money. The body names the page
 * by its path; the page text comes from the catalogue on the server. The answer
 * streams back as plain UTF-8 text, so the panel can show it as it arrives.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limiter = new RateLimiter(ASSISTANT_RATE_LIMIT);

const FAILURES: Record<AssistantFailure, { status: number; message: string }> = {
  not_configured: {
    status: 503,
    message: 'The assistant is not set up yet. The OpenRouter key is missing or was refused.',
  },
  out_of_credits: {
    status: 402,
    message: 'The OpenRouter account is out of credit. Add credit, then ask again.',
  },
  busy: { status: 429, message: 'That model is busy right now. Try again, or pick another model.' },
  upstream: {
    status: 502,
    message: 'The model could not answer just now. Try again, or pick another model.',
  },
};

function json(status: number, error: string, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error, message }, { status, ...(headers && { headers }) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();

    let input: z.infer<typeof askSchema>;
    try {
      input = askSchema.parse(await request.json());
    } catch (error) {
      return json(
        400,
        'invalid_body',
        error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
      );
    }

    const wait = limiter.take(user.uid, Date.now());
    if (wait > 0) {
      return json(
        429,
        'rate_limited',
        `You asked a lot of questions in a short time. Try again in ${Math.ceil(wait / 60)} min.`,
        { 'Retry-After': String(wait) },
      );
    }

    const context = contextForPath(input.path);
    const stream = await streamAnswer(
      input.model,
      buildModelMessages(input, context),
      request.signal,
      input.webSearch === true,
    );
    logger.info('Assistant question', {
      uid: user.uid,
      model: input.model,
      page: context.label,
      webSearch: input.webSearch === true,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        // Cloud Run and proxies pass the stream through instead of buffering it.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof AssistantError) {
      logger.warn('The assistant could not answer', {
        reason: error.reason,
        detail: error.message,
      });
      const failure = FAILURES[error.reason];
      return json(failure.status, error.reason, failure.message);
    }
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('The assistant failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
