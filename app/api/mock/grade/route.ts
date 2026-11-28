import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MODEL_FAILURES } from '@/lib/assistant/failures';
import { buildGradeMessages, gradeRequestSchema, parseGrade } from '@/lib/assistant/grade';
import { RateLimiter } from '@/lib/assistant/rate-limit';
import { getProblem } from '@/lib/course/catalog';
import { getRunnable } from '@/lib/course/runnables';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { AssistantError, streamAnswer } from '@/services/openrouter.service';

/**
 * `POST /api/mock/grade` asks Pip to grade a written mock answer against the
 * problem's senior signals, and answers with JSON: the signals shown, a quote
 * as evidence for each, one follow-up question and a short summary.
 *
 * The problem's text and signals come from the catalogue on the server, never
 * from the request. `parseGrade` keeps only the signals whose quote is in the
 * learner's own words. The grade changes nothing on the server: the mock
 * keeps its state in the browser (ADR-0017), and the browser stores it there.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A loop has at most a dozen written questions, each graded twice. */
const limiter = new RateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });

/** A grade is a short JSON object. */
const GRADE_MAX_TOKENS = 900;
const GRADE_TIMEOUT_MS = 60_000;

function json(status: number, error: string, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error, message }, { status, ...(headers && { headers }) });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    text += decoder.decode(value, { stream: true });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();

    let input: z.infer<typeof gradeRequestSchema>;
    try {
      input = gradeRequestSchema.parse(await request.json());
    } catch (error) {
      return json(
        400,
        'invalid_body',
        error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
      );
    }

    const problem = getProblem(input.slug);
    if (problem === undefined || problem.signals.length === 0) {
      return json(404, 'unknown_problem', 'That problem does not exist.');
    }
    if (getRunnable(problem.slug) !== undefined) {
      return json(400, 'runnable_problem', 'Its tests grade this problem.');
    }

    const wait = limiter.take(user.uid, Date.now());
    if (wait > 0) {
      return json(
        429,
        'rate_limited',
        `Pip graded a lot of answers in a short time. Try again in ${Math.ceil(wait / 60)} min.`,
        { 'Retry-After': String(wait) },
      );
    }

    const stream = await streamAnswer(
      input.model,
      buildGradeMessages(problem, input),
      request.signal,
      false,
      { maxTokens: GRADE_MAX_TOKENS, timeoutMs: GRADE_TIMEOUT_MS },
    );
    const text = await readAll(stream);
    const learnerText = [input.answer, input.followUp?.reply ?? ''].join('\n');
    const grade = parseGrade(text, problem.signals.length, learnerText);
    if (grade === null) {
      logger.warn('Pip gave no usable grade', {
        uid: user.uid,
        slug: problem.slug,
        model: input.model,
      });
      return json(
        502,
        'no_grade',
        'Pip could not grade this answer just now. Try again, or pick another model.',
      );
    }
    logger.info('Mock answer graded', {
      uid: user.uid,
      slug: problem.slug,
      model: input.model,
      followUp: input.followUp !== undefined,
      covered: grade.covered.length,
      signals: problem.signals.length,
    });
    return NextResponse.json(grade, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AssistantError) {
      logger.warn('Pip could not grade an answer', { reason: error.reason, detail: error.message });
      const failure = MODEL_FAILURES[error.reason];
      return json(failure.status, error.reason, failure.message);
    }
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Grading a mock answer failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
