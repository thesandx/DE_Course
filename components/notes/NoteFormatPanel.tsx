'use client';

import { useEffect, useRef, useState } from 'react';

import { PipMascot } from '@/components/assistant/PipMascot';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import {
  ASSISTANT_MODELS,
  DEFAULT_MODEL_ID,
  isAssistantModel,
  MODEL_STORAGE_KEY,
} from '@/lib/assistant/models';
import { unwrapAnswer } from '@/lib/notes/format';
import {
  FORMAT_MODE_LABELS,
  FORMAT_MODES,
  type FormatMode,
  MAX_FORMAT_INSTRUCTION,
} from '@/lib/notes/limits';
import { cn } from '@/lib/utils';

import { NoteView } from './NoteView';

export interface NoteFormatPanelProps {
  noteKey: string;
  /** False when the server has no OpenRouter key. */
  enabled: boolean;
  /** The note as it is now in the editor. */
  getMarkdown: () => string;
  /** The learner chose Pip's version. */
  onUse: (markdown: string) => void;
  onClose: () => void;
  className?: string | undefined;
}

type Phase = 'choose' | 'working' | 'done';

function readModel(): string {
  try {
    const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
    return saved !== null && isAssistantModel(saved) ? saved : DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

/**
 * "Format with Pip": the learner picks how (tidy, revision sheet, or their own
 * words), Pip streams a formatted copy, and the learner sees it before
 * choosing. Nothing changes until they press "Use Pip's version", and undo in
 * the editor brings their own version back after that.
 */
export function NoteFormatPanel({
  noteKey,
  enabled,
  getMarkdown,
  onUse,
  onClose,
  className,
}: NoteFormatPanelProps) {
  const [mode, setMode] = useState<FormatMode>('tidy');
  const [instruction, setInstruction] = useState('');
  // The panel opens on a click, so it never renders on the server.
  const [model, setModel] = useState(readModel);
  const [phase, setPhase] = useState<Phase>('choose');
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function chooseModel(id: string) {
    if (!isAssistantModel(id)) return;
    setModel(id);
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {
      // Remembering the model is a convenience only.
    }
  }

  async function start() {
    const markdown = getMarkdown();
    setError(null);
    setResult('');
    setPhase('working');
    const controller = new AbortController();
    abortRef.current = controller;
    let answer = '';
    try {
      const response = await fetch('/api/notes/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: noteKey,
          markdown,
          mode,
          model,
          ...(mode === 'custom' && { instruction }),
        }),
        signal: controller.signal,
      });
      if (!response.ok || response.body === null) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          response.status === 401
            ? 'Your session ended. Sign in again to ask Pip.'
            : typeof body === 'object' && body !== null && 'message' in body
              ? String(body.message)
              : 'Pip could not format the note just now. Try again.',
        );
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setResult(answer);
      }
      if (answer.trim() === '') throw new Error('Pip sent back an empty note. Try again.');
      setResult(unwrapAnswer(answer));
      setPhase('done');
    } catch (caught) {
      if (controller.signal.aborted) {
        setPhase(answer.trim() === '' ? 'choose' : 'done');
        setResult(unwrapAnswer(answer));
        return;
      }
      setError(
        caught instanceof TypeError
          ? 'You look offline. Your note is safe; ask Pip again when you are back online.'
          : caught instanceof Error
            ? caught.message
            : 'Pip could not format the note just now.',
      );
      setPhase('choose');
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div
      className={cn(
        'border-line bg-paper animate-rise-in flex flex-col gap-4 border-t px-4 py-4 sm:px-5',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <PipMascot
          size={40}
          mood={phase === 'working' ? 'thinking' : 'happy'}
          blink={phase !== 'working'}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-heading font-display leading-tight font-semibold">Format with Pip</p>
          <p className="text-small text-ink-soft">
            {phase === 'working'
              ? 'Pip is tidying your notes…'
              : phase === 'done'
                ? 'Here is Pip’s version. Your note has not changed yet.'
                : 'Pip rewrites a copy. You choose whether to use it.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            onClose();
          }}
          aria-label="Close Format with Pip"
          className="text-ink-faint hover:text-ink inline-grid size-11 shrink-0 place-items-center"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5 stroke-current"
            fill="none"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {!enabled ? (
        <Alert tone="info" title="Pip is not set up yet">
          Add the OpenRouter key on the server to turn on formatting. Your notes work without it.
        </Alert>
      ) : phase === 'choose' ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow text-ink-faint mb-2">How should Pip format it?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {FORMAT_MODES.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'rounded-input bg-surface flex min-h-11 cursor-pointer flex-col gap-0.5 border px-3 py-2',
                    mode === option ? 'border-ink' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`format-mode-${noteKey}`}
                      value={option}
                      checked={mode === option}
                      onChange={() => setMode(option)}
                      className="accent-brand size-4"
                    />
                    <span className="text-small font-semibold">
                      {FORMAT_MODE_LABELS[option].label}
                    </span>
                  </span>
                  <span className="text-small text-ink-soft">
                    {FORMAT_MODE_LABELS[option].note}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {mode === 'custom' && (
            <label className="flex flex-col gap-1">
              <span className="text-small font-semibold">Tell Pip how</span>
              <input
                type="text"
                value={instruction}
                maxLength={MAX_FORMAT_INSTRUCTION}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="For example: make it a step-by-step checklist"
                className="bg-surface border-line-strong rounded-input text-body placeholder:text-ink-faint focus:border-ink-faint min-h-11 border px-3 outline-none"
              />
            </label>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 items-center gap-2 sm:flex-1">
              <span className="text-small text-ink-soft shrink-0">Model</span>
              <select
                value={model}
                onChange={(event) => chooseModel(event.target.value)}
                className="bg-surface border-line rounded-pill text-small text-ink min-h-11 min-w-0 flex-1 cursor-pointer border px-3 font-semibold sm:max-w-xs"
              >
                {ASSISTANT_MODELS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.note}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="w-full sm:w-auto"
              onClick={() => void start()}
              disabled={mode === 'custom' && instruction.trim() === ''}
            >
              Format my notes
            </Button>
          </div>
          {error !== null && (
            <Alert tone="danger" title="Pip could not format the note">
              {error}
            </Alert>
          )}
        </>
      ) : (
        <>
          <div className="bg-surface border-line rounded-card max-h-96 overflow-y-auto border px-4 py-4">
            {result.trim() === '' ? (
              <p className="text-small text-ink-soft flex items-center gap-1.5">
                <span className="animate-breathe bg-brand size-2 rounded-full" />
                <span className="animate-breathe bg-iris size-2 rounded-full" />
                <span className="animate-breathe bg-gold-deep size-2 rounded-full" />
                <span className="ml-1">Reading your notes…</span>
              </p>
            ) : (
              <NoteView markdown={unwrapAnswer(result)} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phase === 'working' ? (
              <Button variant="dark" onClick={() => abortRef.current?.abort()}>
                Stop
              </Button>
            ) : (
              <>
                <Button onClick={() => onUse(unwrapAnswer(result))}>Use Pip’s version</Button>
                <Button variant="secondary" onClick={() => setPhase('choose')}>
                  Try another way
                </Button>
                <Button variant="quiet" onClick={onClose}>
                  Keep mine
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
