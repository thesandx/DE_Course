'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Prose } from '@/components/course/Prose';
import { Icon } from '@/components/layout/Icon';
import { Alert } from '@/components/ui/Alert';
import {
  ASSISTANT_NAME,
  type ChatMessage,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
  MAX_QUOTE_CHARS,
  toCourseDialect,
} from '@/lib/assistant/chat';
import { ASSISTANT_MODELS, DEFAULT_MODEL_ID, isAssistantModel } from '@/lib/assistant/models';
import { cn } from '@/lib/utils';

import { PipMascot } from './PipMascot';

export interface DoubtAssistantProps {
  /** False when the server has no OpenRouter key. The panel then says so instead of asking. */
  enabled: boolean;
  className?: string;
}

const MODEL_KEY = 'loop-ready-assistant-model';
const CHAT_KEY_PREFIX = 'loop-ready-assistant-chat:';
/** A selection made this recently counts as "the text I am asking about". */
const SELECTION_FRESH_MS = 20_000;

function suggestionsFor(path: string): readonly string[] {
  if (path.startsWith('/de/problems/')) {
    return [
      'Give me a small hint, not the answer',
      'What is the interviewer testing here?',
      'Walk me through the approach',
      'What follow-up could they ask?',
    ];
  }
  if (path.startsWith('/gcp/labs/')) {
    return [
      'What does this lab teach me?',
      'A step failed. How do I debug it?',
      'How does this show up in the exam?',
    ];
  }
  return [
    'Explain this page in simple words',
    'Give me a real-world example',
    'How would an interviewer ask about this?',
    'Quiz me with one question',
  ];
}

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    // Private mode or blocked storage: the panel works without memory.
    return null;
  }
}

function writeStorage(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Same as above: remembering is a convenience, never a requirement.
  }
}

function loadChat(path: string): ChatMessage[] {
  const raw = readStorage(() => window.sessionStorage, CHAT_KEY_PREFIX + path);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChatMessage =>
        typeof item === 'object' &&
        item !== null &&
        'role' in item &&
        (item.role === 'user' || item.role === 'assistant') &&
        'content' in item &&
        typeof item.content === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Pip, the AI doubt helper. A round button floats at the bottom right of every
 * signed-in page. It opens a chat panel that knows which lesson, problem or
 * lab the learner is on: the server reads that page's text and gives it to the
 * model with the question. Text the learner selected on the page just before
 * opening the panel is sent too, as the exact thing they are asking about.
 *
 * On a phone the panel is a sheet over the page; from `md` up it is a card at
 * the bottom right, so the lesson stays readable beside it.
 *
 * The model comes from the dropdown and is remembered in this browser. The
 * chat is remembered per page for the browser session.
 */
export function DoubtAssistant({ enabled, className }: DoubtAssistantProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<{ text: string; at: number } | null>(null);

  // The chat belongs to the page. A new page loads its own chat. Updating
  // state during render is React's pattern for resetting on a prop change.
  if (loadedPath !== pathname && typeof window !== 'undefined') {
    if (loadedPath === null) {
      // The first client render: also read the remembered model. Nothing that
      // reads it is on screen until the panel opens, so hydration still matches.
      const saved = readStorage(() => window.localStorage, MODEL_KEY);
      if (saved !== null && isAssistantModel(saved)) setModel(saved);
    }
    setLoadedPath(pathname);
    setMessages(loadChat(pathname));
    setQuote(null);
    setError(null);
  }

  useEffect(() => {
    if (loadedPath === null || streaming) return;
    writeStorage(
      () => window.sessionStorage,
      CHAT_KEY_PREFIX + loadedPath,
      messages.length === 0 ? null : JSON.stringify(messages.slice(-MAX_HISTORY)),
    );
  }, [messages, loadedPath, streaming]);

  // Remember the last text the learner selected on the page, outside the panel.
  // Tapping the button clears a selection on a phone, so it is kept here first.
  useEffect(() => {
    function onSelection() {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (text === '') return;
      const anchor = selection?.anchorNode ?? null;
      if (anchor !== null && panelRef.current?.contains(anchor)) return;
      selectionRef.current = { text: text.slice(0, MAX_QUOTE_CHARS), at: Date.now() };
    }
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  }, [messages, open]);

  // Stop a running answer when the panel unmounts, so nothing keeps billing.
  useEffect(() => () => abortRef.current?.abort(), []);

  function openPanel() {
    const selected = selectionRef.current;
    if (selected !== null && Date.now() - selected.at < SELECTION_FRESH_MS) {
      setQuote(selected.text);
    }
    selectionRef.current = null;
    setOpen(true);
  }

  function chooseModel(id: string) {
    if (!isAssistantModel(id)) return;
    setModel(id);
    writeStorage(() => window.localStorage, MODEL_KEY, id);
  }

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim().slice(0, MAX_MESSAGE_CHARS);
      if (text === '' || streaming || !enabled) return;

      const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
      setMessages([...history, { role: 'assistant', content: '' }]);
      setDraft('');
      setError(null);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let answer = '';

      try {
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            path: pathname,
            ...(quote !== null && { quote }),
            messages: history.slice(-MAX_HISTORY),
          }),
          signal: controller.signal,
        });

        if (!response.ok || response.body === null) {
          const body: unknown = await response.json().catch(() => null);
          const message =
            typeof body === 'object' && body !== null && 'message' in body
              ? String(body.message)
              : 'Pip could not answer just now. Try again.';
          throw new Error(
            response.status === 401 ? 'Your session ended. Sign in again to ask Pip.' : message,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += decoder.decode(value, { stream: true });
          const partial = answer;
          setMessages([...history, { role: 'assistant', content: partial }]);
        }
        if (answer.trim() === '') throw new Error('The model sent an empty answer. Try again.');
        setQuote(null);
      } catch (caught) {
        const stopped = controller.signal.aborted;
        if (answer.trim() === '') setMessages(history);
        if (!stopped) {
          setError(caught instanceof Error ? caught.message : 'Pip could not answer just now.');
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [enabled, messages, model, pathname, quote, streaming],
  );

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setQuote(null);
  }

  const lastIndex = messages.length - 1;
  const waiting = streaming && messages[lastIndex]?.content === '';

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label={`Ask ${ASSISTANT_NAME}, your AI doubt helper`}
          className={cn(
            'squish bg-surface border-line shadow-float rounded-pill fixed right-4 bottom-24 z-30 inline-flex min-h-14 items-center gap-2 border p-1.5 md:right-6 md:bottom-6 md:pr-5',
            className,
          )}
        >
          <PipMascot size={44} blink />
          <span className="text-body hidden font-semibold md:inline">Ask {ASSISTANT_NAME}</span>
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${ASSISTANT_NAME}, your AI doubt helper`}
          className="bg-paper border-line shadow-float rounded-t-sheet animate-rise-in fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col overflow-hidden border md:inset-auto md:top-24 md:right-6 md:bottom-6 md:w-full md:max-w-md md:rounded-sheet"
        >
          <header className="bg-night-glow text-on-night flex items-center gap-3 px-4 py-3">
            <PipMascot size={40} mood={streaming ? 'thinking' : 'happy'} blink={!streaming} />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-display text-heading leading-tight font-semibold">
                {ASSISTANT_NAME}
              </p>
              <p className="text-small text-on-night-soft truncate">
                {streaming ? 'Thinking it through…' : 'Your friendly doubt helper'}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="text-small text-on-night-soft hover:text-on-night min-h-11 px-2 font-semibold"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the helper"
              className="border-night-line hover:border-on-night-soft inline-grid size-11 shrink-0 place-items-center rounded-full border"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="stroke-on-night size-5"
                fill="none"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="border-line bg-surface flex items-center gap-2 border-b px-4 py-2">
            <label htmlFor="assistant-model" className="text-small text-ink-soft shrink-0">
              Model
            </label>
            <div className="relative min-w-0 flex-1">
              <select
                id="assistant-model"
                value={model}
                onChange={(event) => chooseModel(event.target.value)}
                className="bg-sunken border-line rounded-pill text-small text-ink min-h-11 w-full cursor-pointer appearance-none border pr-9 pl-3 font-semibold"
              >
                {ASSISTANT_MODELS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.note}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="stroke-ink pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                fill="none"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4"
            aria-live="polite"
          >
            {!enabled ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <PipMascot size={88} mood="sleepy" />
                <p className="text-heading font-semibold">{ASSISTANT_NAME} is not set up yet</p>
                <p className="text-small text-ink-soft max-w-xs">
                  Add the OpenRouter key on the server to wake me up. The steps are in
                  cloud/environment-variables.md, under “AI doubt assistant”.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <PipMascot size={88} blink mood="happy" />
                <div className="bg-surface border-line rounded-card shadow-card relative max-w-xs border px-4 py-3">
                  <p className="text-body">
                    Hi! I’m {ASSISTANT_NAME}. Stuck on something here? Ask me anything about this
                    page, and I’ll explain it step by step.
                  </p>
                </div>
                <p className="text-small text-ink-faint max-w-xs">
                  Tip: select a line on the page first, then open me, and I’ll explain that line.
                </p>
                <ul className="flex w-full flex-col gap-2">
                  {suggestionsFor(pathname).map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => void ask(suggestion)}
                        className="bg-surface border-line hover:border-line-strong rounded-input text-small flex min-h-11 w-full items-center gap-2 border px-3 py-2 text-left font-semibold"
                      >
                        <Icon name="spark" className="text-brand-deep size-4 shrink-0" />
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((message, index) =>
                message.role === 'user' ? (
                  <div
                    key={index}
                    className="bg-ink text-on-ink rounded-card text-body ml-10 self-end px-4 py-2.5 whitespace-pre-wrap"
                  >
                    {message.content}
                  </div>
                ) : (
                  <div key={index} className="flex min-w-0 items-start gap-2">
                    <PipMascot
                      size={28}
                      mood={streaming && index === lastIndex ? 'thinking' : 'happy'}
                      className="mt-1"
                    />
                    <div className="bg-surface border-line rounded-card shadow-card min-w-0 flex-1 border px-4 py-3">
                      {waiting && index === lastIndex ? (
                        <p className="text-small text-ink-soft flex items-center gap-1.5">
                          <span className="animate-breathe bg-brand size-2 rounded-full" />
                          <span className="animate-breathe bg-iris size-2 rounded-full" />
                          <span className="animate-breathe bg-gold-deep size-2 rounded-full" />
                          <span className="ml-1">Pip is thinking…</span>
                        </p>
                      ) : (
                        <Prose source={toCourseDialect(message.content)} className="text-small" />
                      )}
                    </div>
                  </div>
                ),
              )
            )}
            {error !== null && (
              <Alert tone="danger" title="Pip could not answer">
                {error}
              </Alert>
            )}
          </div>

          {enabled && (
            <form
              className="border-line bg-surface flex flex-col gap-2 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(draft);
              }}
            >
              {quote !== null && (
                <div className="bg-sunken border-l-brand rounded-input flex items-start gap-2 border-l-4 px-3 py-2">
                  <p className="text-small text-ink-soft line-clamp-2 min-w-0 flex-1">
                    <span className="text-ink font-semibold">About: </span>“{quote}”
                  </p>
                  <button
                    type="button"
                    onClick={() => setQuote(null)}
                    aria-label="Remove the selected text"
                    className="text-ink-faint hover:text-ink -my-2 inline-grid size-11 shrink-0 place-items-center"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-4 stroke-current"
                      fill="none"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label htmlFor="assistant-question" className="sr-only">
                  Your doubt
                </label>
                <textarea
                  id="assistant-question"
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void ask(draft);
                    }
                  }}
                  rows={2}
                  maxLength={MAX_MESSAGE_CHARS}
                  placeholder="Ask your doubt…"
                  className="bg-paper border-line-strong rounded-input text-body placeholder:text-ink-faint focus:border-ink-faint min-h-12 flex-1 resize-none border px-3 py-2.5 outline-none"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="squish bg-ink text-on-ink rounded-pill text-small inline-flex min-h-12 shrink-0 items-center px-4 font-semibold"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={draft.trim() === ''}
                    aria-label="Send"
                    className="squish bg-brand text-on-night shadow-glow hover:bg-brand-hover disabled:bg-sunken disabled:text-ink-faint inline-grid size-12 shrink-0 place-items-center rounded-full"
                  >
                    <Icon name="arrow-right" className="size-5" />
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
