'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { TextHighlight } from '@/lib/notes/highlights';
import { LOCAL_NOTE_PREFIX } from '@/lib/notes/limits';
import { textHighlightsSchema } from '@/lib/notes/schema';

/**
 * Keeps the highlights of one chapter on this device first, and in the cloud
 * second — the same model as `useNoteSync`, for a list instead of a text.
 *
 * A page has several highlightable sections (a problem's question and its
 * answer, a station's concepts), and each one calls this hook with the same
 * key. So the list lives in one store per key, shared by every section, and
 * each section shows only the highlights for its own scope.
 *
 * The device copy uses the notes prefix, so signing out clears it with the
 * notes (`clearLocalNotes`).
 */

interface Entry {
  items: TextHighlight[];
  editedAt: string;
  synced: boolean;
  loaded: boolean;
  inFlight: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: Set<() => void>;
}

export interface TextHighlightsApi {
  items: TextHighlight[];
  /** Replaces the whole list for the chapter. */
  save: (next: TextHighlight[]) => void;
}

const SYNC_DELAY_MS = 400;
const RETRY_MS = 20_000;
const TIMEOUT_MS = 15_000;
const EMPTY: TextHighlight[] = [];

const entries = new Map<string, Entry>();

function storageKey(key: string): string {
  return `${LOCAL_NOTE_PREFIX}highlights:${key}`;
}

interface LocalCopy {
  items: TextHighlight[];
  editedAt: string;
  synced: boolean;
}

function readLocal(key: string): LocalCopy | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const items = textHighlightsSchema.safeParse('items' in parsed ? parsed.items : null);
    if (
      !items.success ||
      !('editedAt' in parsed) ||
      typeof parsed.editedAt !== 'string' ||
      !('synced' in parsed) ||
      typeof parsed.synced !== 'boolean'
    ) {
      return null;
    }
    return { items: items.data, editedAt: parsed.editedAt, synced: parsed.synced };
  } catch {
    // Private mode, blocked storage or a damaged entry: the cloud copy still works.
    return null;
  }
}

function writeLocal(key: string, entry: Entry): void {
  try {
    const copy: LocalCopy = { items: entry.items, editedAt: entry.editedAt, synced: entry.synced };
    window.localStorage.setItem(storageKey(key), JSON.stringify(copy));
  } catch {
    // Storage full or blocked. The cloud save still runs.
  }
}

function entryFor(key: string): Entry {
  let entry = entries.get(key);
  if (entry === undefined) {
    entry = {
      items: EMPTY,
      editedAt: '',
      synced: true,
      loaded: false,
      inFlight: false,
      timer: null,
      listeners: new Set(),
    };
    entries.set(key, entry);
  }
  return entry;
}

function notify(entry: Entry): void {
  for (const listener of entry.listeners) listener();
}

/** The stored list from an API answer, or null when the answer has none. */
function storedFrom(body: unknown): { items: TextHighlight[]; editedAt: string } | null {
  if (typeof body !== 'object' || body === null || !('highlights' in body)) return null;
  const stored = body.highlights;
  if (typeof stored !== 'object' || stored === null) return null;
  const items = textHighlightsSchema.safeParse('items' in stored ? stored.items : null);
  if (!items.success || !('editedAt' in stored) || typeof stored.editedAt !== 'string') {
    return null;
  }
  return { items: items.data, editedAt: stored.editedAt };
}

function schedule(key: string, delay: number): void {
  const entry = entryFor(key);
  if (entry.timer !== null) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => void push(key), delay);
}

async function push(key: string): Promise<void> {
  const entry = entryFor(key);
  entry.timer = null;
  if (entry.synced) return;
  if (entry.inFlight) {
    schedule(key, SYNC_DELAY_MS);
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  entry.inFlight = true;
  const sent = entry.editedAt;
  try {
    const response = await fetch('/api/notes/highlights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, items: entry.items, editedAt: sent }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // A 4xx will not pass on a retry; the device copy keeps the highlights.
      if (response.status >= 500) schedule(key, RETRY_MS);
      return;
    }
    const result: unknown = await response.json();
    const kept =
      typeof result === 'object' && result !== null && 'kept' in result ? result.kept : null;
    if (kept === 'newer') {
      // Another device changed the highlights later. Its list wins.
      const stored = storedFrom(result);
      if (stored !== null) {
        entry.items = stored.items;
        entry.editedAt = stored.editedAt;
        entry.synced = true;
        writeLocal(key, entry);
        notify(entry);
      }
      return;
    }
    // Mark it synced only if nothing changed while the save was on its way.
    if (entry.editedAt === sent) {
      entry.synced = true;
      writeLocal(key, entry);
    } else {
      schedule(key, SYNC_DELAY_MS);
    }
  } catch {
    // No connection, or the save timed out. The device copy is safe.
    schedule(key, RETRY_MS);
  } finally {
    entry.inFlight = false;
  }
}

/** Reads the device copy, then the cloud copy, once per chapter per page load. */
async function load(key: string): Promise<void> {
  const entry = entryFor(key);
  if (entry.loaded) return;
  entry.loaded = true;
  const local = readLocal(key);
  if (local !== null) {
    entry.items = local.items;
    entry.editedAt = local.editedAt;
    entry.synced = local.synced;
    notify(entry);
  }
  try {
    const response = await fetch(`/api/notes/highlights?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return;
    const stored = storedFrom(await response.json());
    if (stored !== null && stored.editedAt > entry.editedAt) {
      entry.items = stored.items;
      entry.editedAt = stored.editedAt;
      entry.synced = true;
      writeLocal(key, entry);
      notify(entry);
    } else if (!entry.synced) {
      schedule(key, 0);
    }
  } catch {
    // Offline: the device copy is shown, and a change syncs when the connection is back.
  }
}

export function useTextHighlights(key: string): TextHighlightsApi {
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = entryFor(key);
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    [key],
  );
  const items = useSyncExternalStore(
    subscribe,
    () => entryFor(key).items,
    () => EMPTY,
  );

  useEffect(() => {
    void load(key);
    const back = (): void => {
      if (!entryFor(key).synced) schedule(key, 0);
    };
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [key]);

  const save = useCallback(
    (next: TextHighlight[]) => {
      const entry = entryFor(key);
      entry.items = next;
      entry.editedAt = new Date().toISOString();
      entry.synced = false;
      writeLocal(key, entry);
      notify(entry);
      schedule(key, SYNC_DELAY_MS);
    },
    [key],
  );

  return { items, save };
}
