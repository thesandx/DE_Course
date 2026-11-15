'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Prose } from '@/components/course/Prose';
import { Icon } from '@/components/layout/Icon';
import { Alert } from '@/components/ui/Alert';
import { IMAGE_ACCEPT, useImageAttachments } from '@/hooks/useImageAttachments';
import {
  ASSISTANT_NAME,
  type ChatMessage,
  defaultImageQuestion,
  MAX_HISTORY,
  MAX_IMAGES_PER_MESSAGE,
  MAX_MESSAGE_CHARS,
  MAX_QUOTE_CHARS,
  messagesToSend,
  toCourseDialect,
} from '@/lib/assistant/chat';
import {
  ASSISTANT_MODELS,
  DEFAULT_MODEL_ID,
  isAssistantModel,
  MODEL_STORAGE_KEY,
  modelReadsImages,
} from '@/lib/assistant/models';
import { hostOf, isWebUrl, splitSources, type WebSource } from '@/lib/assistant/sources';
import { cn } from '@/lib/utils';

import { PipMascot } from './PipMascot';

export interface DoubtAssistantProps {
  /** False when the server has no OpenRouter key. The panel then says so instead of asking. */
  enabled: boolean;
  className?: string;
}

const WEB_KEY = 'loop-ready-assistant-web';
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
      'Check my notes for mistakes',
    ];
  }
  if (path.startsWith('/gcp/labs/')) {
    return [
      'What does this lab teach me?',
      'A step failed. How do I debug it?',
      'How does this show up in the exam?',
      'Check my notes for mistakes',
    ];
  }
  if (/^\/k8s\/ports\/[^/]+\/[^/]+$/.test(path) && !/\/(drill|mission)$/.test(path)) {
    return [
      'Explain this lesson in simple words',
      'A lab step failed. How do I debug it?',
      'How would an interviewer ask about this?',
      'What breaks first in production?',
      'Check my notes for mistakes',
    ];
  }
  const chapter =
    /^\/(de\/tracks\/[^/]+\/[^/]+|gcp\/lines\/[^/]+\/[^/]+)$/.test(path) && !path.endsWith('/boss');
  return [
    'Explain this page in simple words',
    'Give me a real-world example',
    'How would an interviewer ask about this?',
    chapter ? 'Quiz me on my notes' : 'Quiz me with one question',
  ];
}

/**
 * A chat turn in the panel. An answer can carry the web pages it used. A
 * question can carry images; after a reload only their number is left, because
 * images are too large for session storage.
 */
type PanelMessage = ChatMessage & { sources?: WebSource[]; imageCount?: number };

function sourcesOf(value: unknown): WebSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources = value.filter(
    (item): item is WebSource =>
      typeof item === 'object' &&
      item !== null &&
      'url' in item &&
      typeof item.url === 'string' &&
      isWebUrl(item.url) &&
      'title' in item &&
      typeof item.title === 'string',
  );
  return sources.length === 0 ? undefined : sources;
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

function loadChat(path: string): PanelMessage[] {
  const raw = readStorage(() => window.sessionStorage, CHAT_KEY_PREFIX + path);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ChatMessage =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          (item.role === 'user' || item.role === 'assistant') &&
          'content' in item &&
          typeof item.content === 'string',
      )
      .map((item) => {
        const sources = 'sources' in item ? sourcesOf(item.sources) : undefined;
        const imageCount =
          'imageCount' in item && typeof item.imageCount === 'number' ? item.imageCount : 0;
        return {
          role: item.role,
          content: item.content,
          ...(sources !== undefined && { sources }),
          ...(imageCount > 0 && { imageCount }),
        };
      });
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
 *
 * The photo button attaches up to three images to a question: a screenshot
 * of an error, a query plan, a diagram or a photo of handwritten notes. A
 * paste or a drop on the panel works too. The browser shrinks each image
 * before it is sent, and nothing is stored on the server.
 *
 * The globe button turns on web search. The model then also reads fresh web
 * results, and the answer lists the pages it used. It is off by default,
 * because each search adds a small charge; the choice is remembered too.
 */
export function DoubtAssistant({ enabled, className }: DoubtAssistantProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [webSearch, setWebSearch] = useState(false);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const attachments = useImageAttachments();
  const [dragging, setDragging] = useState(false);
  const canAttach = modelReadsImages(model);

  // The chat belongs to the page. A new page loads its own chat. Updating
  // state during render is React's pattern for resetting on a prop change.
  if (loadedPath !== pathname && typeof window !== 'undefined') {
    if (loadedPath === null) {
      // The first client render: also read the remembered model. Nothing that
      // reads it is on screen until the panel opens, so hydration still matches.
      const saved = readStorage(() => window.localStorage, MODEL_STORAGE_KEY);
      if (saved !== null && isAssistantModel(saved)) setModel(saved);
      if (readStorage(() => window.localStorage, WEB_KEY) === 'on') setWebSearch(true);
    }
    setLoadedPath(pathname);
    setMessages(loadChat(pathname));
    setQuote(null);
    setError(null);
    attachments.clear();
  }

  useEffect(() => {
    if (loadedPath === null || streaming) return;
    writeStorage(
      () => window.sessionStorage,
      CHAT_KEY_PREFIX + loadedPath,
      messages.length === 0
        ? null
        : JSON.stringify(
            // Images are too large for session storage; keep only how many there were.
            messages.slice(-MAX_HISTORY).map(({ images, ...rest }) => {
              const count = images?.length ?? rest.imageCount ?? 0;
              return count > 0 ? { ...rest, imageCount: count } : rest;
            }),
          ),
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
    writeStorage(() => window.localStorage, MODEL_STORAGE_KEY, id);
  }

  function toggleWebSearch() {
    const next = !webSearch;
    setWebSearch(next);
    writeStorage(() => window.localStorage, WEB_KEY, next ? 'on' : null);
  }

  const ask = useCallback(
    async (question: string) => {
      const images = canAttach ? attachments.images : [];
      const typed = question.trim().slice(0, MAX_MESSAGE_CHARS);
      const text = typed === '' && images.length > 0 ? defaultImageQuestion(images.length) : typed;
      if (text === '' || streaming || !enabled || attachments.busy) return;

      const history: PanelMessage[] = [
        ...messages,
        { role: 'user', content: text, ...(images.length > 0 && { images }) },
      ];
      setMessages([...history, { role: 'assistant', content: '' }]);
      setDraft('');
      attachments.clear();
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
            ...(webSearch && { webSearch: true }),
            // The server takes the role, the text and the newest images of each turn.
            messages: messagesToSend(history.slice(-MAX_HISTORY)),
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
        let raw = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          const { text: partial, sources } = splitSources(raw);
          answer = partial;
          setMessages([
            ...history,
            { role: 'assistant', content: partial, ...(sources.length > 0 && { sources }) },
          ]);
        }
        if (answer.trim() === '') throw new Error('The model sent an empty answer. Try again.');
        setQuote(null);
      } catch (caught) {
        const stopped = controller.signal.aborted;
        if (answer.trim() === '') {
          setMessages(messages);
          // Give the question back, so a failed send loses neither text nor images.
          setDraft(typed);
          if (images.length > 0) attachments.restore(images);
        }
        if (!stopped) {
          setError(caught instanceof Error ? caught.message : 'Pip could not answer just now.');
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [attachments, canAttach, enabled, messages, model, pathname, quote, streaming, webSearch],
  );

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setQuote(null);
    attachments.clear();
  }

  function pastedImages(items: DataTransferItemList | undefined): File[] {
    return [...(items ?? [])]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
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
          onDragOver={(event) => {
            if (!canAttach || !enabled || !event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setDragging(false);
          }}
          onDrop={(event) => {
            if (!canAttach || !enabled) return;
            event.preventDefault();
            setDragging(false);
            void attachments.add(event.dataTransfer.files);
          }}
          className="bg-paper border-line shadow-float rounded-t-sheet animate-rise-in fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col overflow-hidden border md:inset-auto md:top-24 md:right-6 md:bottom-6 md:w-full md:max-w-md md:rounded-sheet"
        >
          {dragging && (
            <div className="bg-paper/90 border-brand rounded-sheet text-heading text-brand-deep pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 border border-dashed font-semibold">
              <Icon name="image" className="size-8" />
              Drop the image to ask about it
            </div>
          )}
          <header className="bg-night-glow text-on-night flex items-center gap-3 px-4 py-3">
            <PipMascot size={40} mood={streaming ? 'thinking' : 'happy'} blink={!streaming} />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-display text-heading leading-tight font-semibold">
                {ASSISTANT_NAME}
              </p>
              <p className="text-small text-on-night-soft truncate">
                {streaming
                  ? webSearch
                    ? 'Searching the web…'
                    : 'Thinking it through…'
                  : 'Your friendly doubt helper'}
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
            <button
              type="button"
              onClick={toggleWebSearch}
              aria-pressed={webSearch}
              aria-label="Web search"
              title={
                webSearch
                  ? 'Web search is on. Each answer also reads fresh web results.'
                  : 'Turn on web search for fresh facts, versions and docs.'
              }
              className={cn(
                'rounded-pill text-small inline-flex min-h-11 shrink-0 items-center gap-1.5 border px-3 font-semibold',
                webSearch
                  ? 'bg-brand text-on-night border-brand'
                  : 'bg-sunken border-line text-ink-soft hover:text-ink',
              )}
            >
              <Icon name="globe" className="size-4" />
              Web
            </button>
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
                  <div key={index} className="ml-10 flex flex-col items-end gap-1.5 self-end">
                    {message.images !== undefined && message.images.length > 0 && (
                      <ul className="flex flex-wrap justify-end gap-1.5">
                        {message.images.map((url, imageIndex) => (
                          <li key={imageIndex}>
                            {/* A data URL the learner just attached: next/image adds nothing here. */}
                            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, not a remote asset */}
                            <img
                              src={url}
                              alt={`Image ${imageIndex + 1} you attached`}
                              className="border-line rounded-input bg-sunken size-24 border object-cover"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {message.images === undefined && (message.imageCount ?? 0) > 0 && (
                      <p className="text-small text-ink-faint flex items-center gap-1">
                        <Icon name="image" className="size-4" />
                        {message.imageCount === 1 ? '1 image' : `${message.imageCount} images`}{' '}
                        attached
                      </p>
                    )}
                    <div className="bg-ink text-on-ink rounded-card text-body px-4 py-2.5 whitespace-pre-wrap">
                      {message.content}
                    </div>
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
                          <span className="ml-1">
                            {webSearch ? 'Pip is searching the web…' : 'Pip is thinking…'}
                          </span>
                        </p>
                      ) : (
                        <Prose source={toCourseDialect(message.content)} className="text-small" />
                      )}
                      {message.sources !== undefined && message.sources.length > 0 && (
                        <div className="border-line mt-3 border-t pt-2">
                          <p className="text-small text-ink-soft flex items-center gap-1.5 font-semibold">
                            <Icon name="globe" className="size-4" />
                            Sources
                          </p>
                          <ol className="mt-1 flex flex-col">
                            {message.sources.map((source, sourceIndex) => (
                              <li key={source.url}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-small hover:bg-sunken rounded-input -mx-2 flex min-h-11 items-center gap-2 px-2"
                                >
                                  <span className="text-ink-faint font-mono">
                                    {sourceIndex + 1}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="text-ink line-clamp-1 font-semibold">
                                      {source.title}
                                    </span>
                                    <span className="text-ink-faint block truncate">
                                      {hostOf(source.url)}
                                    </span>
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ol>
                        </div>
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
            {attachments.error !== null && (
              <Alert tone="danger" title="Image not added">
                {attachments.error}
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
              {(attachments.images.length > 0 || attachments.busy) && (
                <ul className="flex flex-wrap gap-2" aria-label="Images to send">
                  {attachments.images.map((url, index) => (
                    <li key={index} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, not a remote asset */}
                      <img
                        src={url}
                        alt={`Image ${index + 1} to send`}
                        className="border-line rounded-input bg-sunken size-16 border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => attachments.remove(index)}
                        aria-label={`Remove image ${index + 1}`}
                        className="absolute -top-3 -right-3 inline-grid size-11 place-items-center"
                      >
                        <span className="bg-ink text-on-ink shadow-card inline-grid size-6 place-items-center rounded-full">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="size-3.5 stroke-current"
                            fill="none"
                            strokeWidth="3"
                            strokeLinecap="round"
                          >
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </span>
                      </button>
                    </li>
                  ))}
                  {attachments.busy && (
                    <li className="border-line rounded-input bg-sunken text-ink-faint text-micro inline-grid size-16 place-items-center border">
                      <span className="animate-breathe">Reading…</span>
                    </li>
                  )}
                </ul>
              )}
              <div className="flex items-end gap-2">
                {canAttach && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={IMAGE_ACCEPT}
                      multiple
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(event) => {
                        const files = event.target.files;
                        if (files !== null) void attachments.add(files);
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={attachments.images.length >= MAX_IMAGES_PER_MESSAGE || streaming}
                      aria-label="Attach an image"
                      title="Attach a screenshot or photo (or paste one)"
                      className="bg-sunken border-line text-ink-soft hover:text-ink disabled:text-ink-faint inline-grid size-12 shrink-0 place-items-center rounded-full border disabled:cursor-not-allowed"
                    >
                      <Icon name="image" className="size-5" />
                    </button>
                  </>
                )}
                <label htmlFor="assistant-question" className="sr-only">
                  Your doubt
                </label>
                <textarea
                  id="assistant-question"
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onPaste={(event) => {
                    if (!canAttach) return;
                    const files = pastedImages(event.clipboardData.items);
                    if (files.length === 0) return;
                    event.preventDefault();
                    void attachments.add(files);
                  }}
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
                  placeholder={
                    attachments.images.length > 0 ? 'Ask about the image…' : 'Ask your doubt…'
                  }
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
                    disabled={
                      (draft.trim() === '' && attachments.images.length === 0) || attachments.busy
                    }
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
