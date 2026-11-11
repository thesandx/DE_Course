'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { LOCAL_NOTE_PREFIX } from '@/lib/notes/limits';

/**
 * Keeps one chapter note on this device first, and in the cloud second.
 *
 * Every change is written to `localStorage` at once, so a note survives a
 * closed tab, a dead battery and a lost connection. The cloud copy follows
 * about a second after the learner stops typing, and again when the browser
 * comes back online or the tab is hidden. The newer edit wins on the server
 * (see `services/notes.service.ts`), so two devices settle on the last edit.
 *
 * The device copy is a convenience and a buffer, not the record: the record
 * is the cloud copy, which the notes page and Pip read.
 */

export interface ServerNote {
  markdown: string;
  editedAt: string;
}

interface LocalNote {
  markdown: string;
  editedAt: string;
  synced: boolean;
}

export type SyncStatus =
  /** Nothing to save yet. */
  | 'idle'
  /** Saved on this device; the cloud copy is on its way. */
  | 'pending'
  | 'saving'
  /** The cloud copy matches. */
  | 'synced'
  /** No connection. Saved on this device; it syncs when the connection is back. */
  | 'offline'
  /** The server refused the save. `error` says why. */
  | 'error';

/** A newer edit from another device that the server kept instead of this one. */
export interface Conflict {
  markdown: string;
  editedAt: string;
}

export interface NoteSync {
  /** The note to start the editor with, once known. `null` until then. */
  initial: string | null;
  status: SyncStatus;
  error: string | null;
  /** When the cloud copy was last confirmed. */
  syncedAt: string | null;
  conflict: Conflict | null;
  /** Call on every change in the editor. */
  change: (markdown: string) => void;
  /** Accept the newer note from the other device. Returns its Markdown. */
  takeTheirs: () => string | null;
  /** Keep this device's note and save it over the other one. */
  keepMine: () => void;
}

const SYNC_DELAY_MS = 1_200;
const RETRY_MS = 20_000;
const SAVE_TIMEOUT_MS = 15_000;

function storageKey(key: string): string {
  return LOCAL_NOTE_PREFIX + key;
}

function readLocal(key: string): LocalNote | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'markdown' in parsed &&
      typeof parsed.markdown === 'string' &&
      'editedAt' in parsed &&
      typeof parsed.editedAt === 'string' &&
      'synced' in parsed &&
      typeof parsed.synced === 'boolean'
    ) {
      return { markdown: parsed.markdown, editedAt: parsed.editedAt, synced: parsed.synced };
    }
    return null;
  } catch {
    // Private mode, blocked storage or a damaged entry: the cloud copy still works.
    return null;
  }
}

function writeLocal(key: string, note: LocalNote): void {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(note));
  } catch {
    // Storage full or blocked. The cloud save below still runs.
  }
}

/** Removes every note kept on this device. Sign-out calls it, so the next person cannot read them. */
export function clearLocalNotes(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const name = window.localStorage.key(index);
      if (name?.startsWith(LOCAL_NOTE_PREFIX)) keys.push(name);
    }
    for (const name of keys) window.localStorage.removeItem(name);
  } catch {
    // Nothing stored, or storage blocked: nothing to clear.
  }
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export function useNoteSync(key: string, server: ServerNote | null): NoteSync {
  const [initial, setInitial] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(server?.editedAt ?? null);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pushRef = useRef<() => Promise<void>>(async () => {});

  const schedule = useCallback((delay: number) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => void pushRef.current(), delay);
  }, []);

  const push = useCallback(
    async (keepalive = false) => {
      const local = readLocal(key);
      if (local === null || local.synced) return;
      if (!online()) {
        setStatus('offline');
        return;
      }
      if (inFlight.current && !keepalive) {
        schedule(SYNC_DELAY_MS);
        return;
      }
      inFlight.current = true;
      setStatus('saving');
      try {
        const response = await fetch('/api/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, markdown: local.markdown, editedAt: local.editedAt }),
          keepalive,
          signal: AbortSignal.timeout(SAVE_TIMEOUT_MS),
        });
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const message =
            response.status === 401
              ? 'Your session ended. Sign in again; the note is safe on this device.'
              : typeof body === 'object' && body !== null && 'message' in body
                ? String(body.message)
                : 'The note could not be saved to your account.';
          setError(message);
          setStatus('error');
          if (response.status >= 500) schedule(RETRY_MS);
          return;
        }
        const result: unknown = await response.json();
        const latest = readLocal(key);
        if (
          typeof result === 'object' &&
          result !== null &&
          'kept' in result &&
          result.kept === 'newer' &&
          'note' in result &&
          typeof result.note === 'object' &&
          result.note !== null &&
          'markdown' in result.note &&
          typeof result.note.markdown === 'string' &&
          'editedAt' in result.note &&
          typeof result.note.editedAt === 'string'
        ) {
          setConflict({ markdown: result.note.markdown, editedAt: result.note.editedAt });
          setStatus('error');
          setError('A newer version of this note was saved on another device.');
          return;
        }
        // Mark it synced only if nothing changed while the save was on its way.
        if (latest !== null && latest.editedAt === local.editedAt) {
          writeLocal(key, { ...latest, synced: true });
          setStatus('synced');
          setSyncedAt(local.editedAt);
          setError(null);
        } else {
          schedule(SYNC_DELAY_MS);
        }
      } catch {
        // No connection, or the save timed out. The device copy is safe.
        setStatus('offline');
        schedule(RETRY_MS);
      } finally {
        inFlight.current = false;
      }
    },
    [key, schedule],
  );

  useEffect(() => {
    pushRef.current = () => push();
  }, [push]);

  // Decide where to start: the device copy when it holds an edit the cloud
  // has not seen, the cloud copy otherwise.
  useEffect(() => {
    const local = readLocal(key);
    if (local !== null && !local.synced && local.editedAt > (server?.editedAt ?? '')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage exists only after hydration, and the server render must match the first client render
      setInitial(local.markdown);
      setStatus(online() ? 'pending' : 'offline');
      schedule(0);
    } else {
      setInitial(server?.markdown ?? '');
      if (server !== null) {
        writeLocal(key, { markdown: server.markdown, editedAt: server.editedAt, synced: true });
        setStatus('synced');
      }
    }
    // The server note is the page's first render; later renders must not reset the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per chapter
  }, [key]);

  useEffect(() => {
    const flush = (): void => {
      if (document.visibilityState === 'hidden') void push(true);
    };
    const back = (): void => void push();
    const lost = (): void => {
      const local = readLocal(key);
      if (local !== null && !local.synced) setStatus('offline');
    };
    window.addEventListener('online', back);
    window.addEventListener('offline', lost);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('online', back);
      window.removeEventListener('offline', lost);
      document.removeEventListener('visibilitychange', flush);
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [key, push]);

  const change = useCallback(
    (markdown: string) => {
      writeLocal(key, { markdown, editedAt: new Date().toISOString(), synced: false });
      setConflict(null);
      setStatus(online() ? 'pending' : 'offline');
      schedule(SYNC_DELAY_MS);
    },
    [key, schedule],
  );

  const takeTheirs = useCallback((): string | null => {
    if (conflict === null) return null;
    writeLocal(key, { markdown: conflict.markdown, editedAt: conflict.editedAt, synced: true });
    setConflict(null);
    setError(null);
    setStatus('synced');
    setSyncedAt(conflict.editedAt);
    return conflict.markdown;
  }, [conflict, key]);

  const keepMine = useCallback(() => {
    const local = readLocal(key);
    if (local === null) return;
    // A fresh edit time makes this device's note the newer one.
    writeLocal(key, { ...local, editedAt: new Date().toISOString(), synced: false });
    setConflict(null);
    setError(null);
    schedule(0);
  }, [key, schedule]);

  return { initial, status, error, syncedAt, conflict, change, takeTheirs, keepMine };
}
