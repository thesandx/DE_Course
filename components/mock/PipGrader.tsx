'use client';

import { useEffect, useRef, useState } from 'react';

import { PipMascot } from '@/components/assistant/PipMascot';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import type { Grade } from '@/lib/assistant/grade';
import { DEFAULT_MODEL_ID, isAssistantModel, MODEL_STORAGE_KEY } from '@/lib/assistant/models';
import type { PipGrade } from '@/lib/course/mock-session';

export interface PipGraderProps {
  slug: string;
  /** What the learner wrote in the round, or null when there is nothing. */
  answer: string | null;
  /** Pip's grade so far, from the session. */
  grade: PipGrade | undefined;
  /** False when the server has no OpenRouter key. */
  enabled: boolean;
  onGrade: (grade: PipGrade) => void;
}

function readModel(): string {
  try {
    const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
    return saved !== null && isAssistantModel(saved) ? saved : DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

function isGrade(value: unknown): value is Grade {
  return (
    typeof value === 'object' &&
    value !== null &&
    'covered' in value &&
    Array.isArray(value.covered) &&
    'followUp' in value &&
    typeof value.followUp === 'string' &&
    'summary' in value &&
    typeof value.summary === 'string'
  );
}

/**
 * Pip grades a written mock answer: it credits only the signals it can quote
 * from the answer, says what was strong and what was missing, and asks one
 * follow-up. The learner may answer the follow-up once, and Pip grades the
 * whole exchange again. Pip's grade replaces the learner's own ticks.
 */
export function PipGrader({ slug, answer, grade, enabled, onGrade }: PipGraderProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const written = answer?.trim() ?? '';
  if (!enabled) return null;

  async function ask(followUp?: { question: string; reply: string }) {
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch('/api/mock/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          answer: written,
          model: readModel(),
          ...(followUp !== undefined && { followUp }),
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(75_000)]),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isGrade(body)) {
        throw new Error(
          response.status === 401
            ? 'Your session ended. Sign in again to ask Pip.'
            : typeof body === 'object' && body !== null && 'message' in body
              ? String(body.message)
              : 'Pip could not grade this answer just now. Try again.',
        );
      }
      onGrade({
        covered: [...body.covered],
        followUp: body.followUp,
        summary: body.summary,
        replied: followUp !== undefined,
        ...(followUp !== undefined && { question: followUp.question, reply: followUp.reply }),
      });
      setReply('');
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Pip could not grade this answer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Pip's grade"
      className="bg-sunken border-line rounded-card flex flex-col gap-4 border p-5"
    >
      <div className="flex items-start gap-3">
        <PipMascot size={40} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-heading">{grade === undefined ? 'Grade with Pip' : "Pip's grade"}</h3>
          <p className="text-small text-ink-soft">
            {grade === undefined
              ? 'Pip reads your answer and credits only the signals it can quote from it, then asks one follow-up. Its grade replaces your own ticks.'
              : grade.summary}
          </p>
        </div>
      </div>

      {grade === undefined ? (
        written === '' ? (
          <p className="text-small text-ink-soft">
            You wrote no answer in this round, so there is nothing to grade.
          </p>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void ask()}
            disabled={busy}
            className="self-start"
          >
            {busy ? 'Pip is reading' : 'Grade my answer'}
          </Button>
        )
      ) : null}

      {grade?.replied === true && grade.question !== undefined ? (
        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold">You were asked: {grade.question}</p>
          <p className="bg-surface rounded-input text-body px-4 py-3 break-words whitespace-pre-wrap">
            {grade.reply}
          </p>
        </div>
      ) : null}

      {grade !== undefined && grade.followUp !== '' ? (
        <div className="flex flex-col gap-3">
          <p className="text-body">
            <span className="font-semibold">
              {grade.replied ? 'One more to think about: ' : 'Follow-up: '}
            </span>
            {grade.followUp}
          </p>
          {grade.replied ? null : (
            <>
              <Textarea
                label="Your reply"
                hint="Answer as you would out loud. Pip grades your answer and this reply together, once."
                rows={5}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
              <Button
                variant="secondary"
                onClick={() => void ask({ question: grade.followUp, reply: reply.trim() })}
                disabled={busy || reply.trim() === ''}
                className="self-start"
              >
                {busy ? 'Pip is reading' : 'Send my reply'}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {busy ? <Spinner label="Pip is grading" /> : null}
      {error !== null ? <Alert tone="danger" title={error} /> : null}
    </section>
  );
}
