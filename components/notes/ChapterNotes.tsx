'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PipMascot } from '@/components/assistant/PipMascot';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { type ServerNote, type SyncStatus, useNoteSync } from '@/hooks/useNoteSync';
import { MAX_NOTE_CHARS } from '@/lib/notes/limits';
import { cn } from '@/lib/utils';

import { NoteEditor, type NoteEditorHandle } from './NoteEditor';
import { NoteFormatPanel } from './NoteFormatPanel';
import { ToolIcon } from './ToolIcon';

export interface ChapterNotesProps {
  /** The chapter's note key, from `lib/notes/targets.ts`. */
  noteKey: string;
  /** The chapter's title, for the editor's accessible name. */
  title: string;
  /** The stored note, read by the page on the server. `null` when there is none. */
  initial: ServerNote | null;
  /** False when the server has no OpenRouter key. Formatting then says so. */
  pipEnabled: boolean;
  className?: string;
}

/** A selection made this recently on the page can be clipped into the note. */
const CLIP_FRESH_MS = 30_000;
const MAX_CLIP_CHARS = 2_000;

const STATUS: Readonly<Record<SyncStatus, { label: string; icon: 'cloud' | 'device' | null }>> = {
  idle: { label: 'Saves as you type', icon: null },
  pending: { label: 'Saved on this device', icon: 'device' },
  saving: { label: 'Saving…', icon: 'cloud' },
  synced: { label: 'Saved', icon: 'cloud' },
  offline: { label: 'Offline · kept on this device', icon: 'device' },
  error: { label: 'Not synced', icon: 'device' },
};

function wordCount(markdown: string): number {
  const words = markdown.replace(/[#*=+~`>[\]\\-]/g, ' ').match(/\S+/g);
  return words === null ? 0 : words.length;
}

/**
 * The notes box at the end of every chapter: the learner's own notes for this
 * lesson, problem, station or lab, in a rich editor that saves as they type.
 *
 * It works like a local notes app. Every change lands on this device at once,
 * and syncs to the learner's account in the background, so a lost connection
 * loses nothing (`hooks/useNoteSync.ts`). The expand button opens a full-screen
 * writing view. "Add selection" clips text the learner selected in the lesson
 * into the note as a quote. "Format with Pip" asks the AI helper to tidy the
 * note, and the learner chooses whether to use the result.
 */
export function ChapterNotes({
  noteKey,
  title,
  initial,
  pipEnabled,
  className,
}: ChapterNotesProps) {
  const sync = useNoteSync(noteKey, initial);
  const editor = useRef<NoteEditorHandle | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const markdownRef = useRef(initial?.markdown ?? '');
  const [words, setWords] = useState(() => wordCount(initial?.markdown ?? ''));
  const [tooLong, setTooLong] = useState(false);
  const [full, setFull] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { change } = sync;
  const onChange = useCallback(
    (markdown: string) => {
      markdownRef.current = markdown;
      setWords(wordCount(markdown));
      const over = markdown.length > MAX_NOTE_CHARS;
      setTooLong(over);
      if (!over) change(markdown);
    },
    [change],
  );

  // Remember text the learner selects on the page, outside the notes, so it
  // can be clipped in. On a phone, tapping the button clears the selection,
  // so it is kept here first.
  useEffect(() => {
    function onSelection() {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (text === '') return;
      const anchor = selection?.anchorNode ?? null;
      if (anchor !== null && sectionRef.current?.contains(anchor)) return;
      if (anchor !== null && anchor.parentElement?.closest('[role="dialog"]') !== null) return;
      setClip(text.slice(0, MAX_CLIP_CHARS));
    }
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  useEffect(() => {
    if (!full) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setFull(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);

  useEffect(() => {
    if (clip === null) return;
    const timer = setTimeout(() => setClip(null), CLIP_FRESH_MS);
    return () => clearTimeout(timer);
  }, [clip]);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 6_000);
    return () => clearTimeout(timer);
  }, [notice]);

  const status = tooLong ? null : STATUS[sync.status];

  function addClip() {
    if (clip === null) return;
    editor.current?.appendQuote(clip);
    setClip(null);
    setNotice('Added the selected text as a quote. Write your thoughts under it.');
  }

  return (
    <section
      ref={sectionRef}
      id="notes"
      aria-labelledby="notes-heading"
      className={cn(
        'bg-surface border-line flex scroll-mt-24 flex-col overflow-hidden border',
        full ? 'animate-fade-in fixed inset-0 z-50 h-dvh' : 'rounded-card shadow-card',
        className,
      )}
    >
      <header className="border-line flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <span
          aria-hidden="true"
          className="bg-butter text-ink rounded-input inline-grid size-10 shrink-0 place-items-center"
        >
          <ToolIcon name="highlight" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="notes-heading" className="text-heading leading-tight">
            My notes
          </h2>
          <p className="text-small text-ink-faint truncate">
            {full ? title : 'Yours only. Saved for your revision.'}
          </p>
        </div>
        {status !== null && (
          <p
            role="status"
            className={cn(
              'text-small rounded-pill hidden shrink-0 items-center gap-1.5 px-2.5 py-1 font-semibold sm:inline-flex',
              sync.status === 'error'
                ? 'bg-danger text-hard'
                : sync.status === 'synced'
                  ? 'bg-success text-easy'
                  : 'bg-sunken text-ink-soft',
            )}
          >
            {status.icon !== null && <ToolIcon name={status.icon} className="size-4" />}
            {status.label}
          </p>
        )}
        <button
          type="button"
          onClick={() => setFull((value) => !value)}
          aria-label={full ? 'Close full screen' : 'Write in full screen'}
          title={full ? 'Close full screen (Esc)' : 'Write in full screen'}
          className="press text-ink-soft hover:text-ink hover:bg-sunken rounded-input inline-grid size-11 shrink-0 place-items-center"
        >
          <ToolIcon name={full ? 'collapse' : 'expand'} className="size-5" />
        </button>
      </header>

      {status !== null && (
        <p className="text-small text-ink-soft border-line flex items-center gap-1.5 border-b px-4 py-1.5 sm:hidden">
          {status.icon !== null && <ToolIcon name={status.icon} className="size-4" />}
          {status.label}
        </p>
      )}

      {sync.conflict !== null && (
        <Alert
          tone="info"
          title="This note changed on another device"
          className="m-3"
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const theirs = sync.takeTheirs();
                  if (theirs !== null) editor.current?.replace(theirs);
                }}
              >
                Use the newer version
              </Button>
              <Button size="sm" variant="quiet" onClick={sync.keepMine}>
                Keep this one
              </Button>
            </div>
          }
        >
          A newer version was saved somewhere else. Pick the one to keep.
        </Alert>
      )}
      {sync.conflict === null && sync.status === 'error' && sync.error !== null && (
        <Alert tone="danger" title="Not synced yet" className="m-3">
          {sync.error}
        </Alert>
      )}
      {tooLong && (
        <Alert tone="danger" title="This note is too long to sync" className="m-3">
          {`Keep a note under ${MAX_NOTE_CHARS.toLocaleString('en')} characters. It is kept on this device until it is shorter.`}
        </Alert>
      )}

      {sync.initial === null ? (
        <div className="flex min-h-48 flex-col gap-3 px-5 py-5" aria-hidden="true">
          <span className="bg-sunken rounded-pill h-3 w-2/3 animate-pulse" />
          <span className="bg-sunken rounded-pill h-3 w-1/2 animate-pulse" />
        </div>
      ) : (
        <NoteEditor
          ref={editor}
          initial={sync.initial}
          onChange={onChange}
          label={`My notes for ${title}`}
          placeholder="Write what you want to remember. Type - for a list, [] for a checklist, ## for a heading."
          tall={full}
        />
      )}

      {notice !== null && (
        <p role="status" className="text-small text-easy bg-success px-4 py-2">
          {notice}
        </p>
      )}

      {formatting && (
        <NoteFormatPanel
          noteKey={noteKey}
          enabled={pipEnabled}
          getMarkdown={() => markdownRef.current}
          onUse={(markdown) => {
            editor.current?.replace(markdown);
            setFormatting(false);
            setNotice('Pip’s version is in. Press undo to bring yours back.');
          }}
          onClose={() => setFormatting(false)}
          className={full ? 'max-h-1/2 overflow-y-auto' : undefined}
        />
      )}

      <footer className="border-line bg-surface flex flex-wrap items-center gap-2 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-5">
        <span className="text-small text-ink-faint mr-auto font-mono">
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        {clip !== null && (
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={addClip}
            className="press text-small text-ink border-line-strong rounded-pill inline-flex min-h-11 items-center gap-1.5 border px-3 font-semibold md:min-h-9"
          >
            <ToolIcon name="clip" className="size-4" />
            Add selection
          </button>
        )}
        {!full && (
          <Link
            href="/notes"
            className="text-small text-ink-soft hover:text-ink inline-flex min-h-11 items-center px-2 font-semibold md:min-h-9"
          >
            All my notes
          </Link>
        )}
        {!formatting && (
          <button
            type="button"
            onClick={() => setFormatting(true)}
            disabled={words === 0}
            className="squish bg-ink text-on-ink disabled:bg-sunken disabled:text-ink-faint rounded-pill text-small inline-flex min-h-11 items-center gap-1.5 py-1 pr-4 pl-1.5 font-semibold md:min-h-9"
          >
            <PipMascot size={28} />
            Format with Pip
          </button>
        )}
      </footer>
    </section>
  );
}
