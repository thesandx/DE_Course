import 'server-only';

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { MAX_NOTE_CHARS } from '@/lib/notes/limits';
import { type NoteTarget, noteTarget } from '@/lib/notes/targets';
import type { SessionUser } from '@/services/auth.service';
import {
  createRepository,
  DocumentAlreadyExistsError,
  type Repository,
} from '@/services/repository';

/**
 * Chapter notes — `notebooks/{uid}/notes/{key}`, one document per chapter.
 *
 * ## Why a subcollection per learner, keyed by the chapter
 *
 * A learner writes one note per chapter, and there are hundreds of chapters,
 * so the notes are unbounded for one document (a note may hold 20,000
 * characters). A subcollection under the learner keeps every note separate:
 * a save writes one small document, and a lesson page reads one key.
 *
 * The id is the chapter's key, such as `de:lesson:sql:window-functions`, so
 * "my note for this page" is a key lookup with no query. Ids are not random,
 * but each notebook takes a few writes a minute from one person, far below
 * the one-write-per-second scale where a key range hotspots. The server
 * accepts only keys that name a real chapter (`lib/notes/targets.ts`), so a
 * notebook can never hold more documents than the catalogue has chapters.
 *
 * ## Offline edits and two devices
 *
 * The browser keeps its own copy and sends it when it is back online, with
 * `editedAt`: when the learner last typed. The newer edit wins. A save older
 * than the stored note is not written, and the answer carries the stored note
 * so the browser can offer it.
 *
 * ## Emptying a note
 *
 * Clearing the editor saves an empty note. Nothing is deleted, and the notes
 * page hides empty notes.
 */

export const NOTEBOOK_COLLECTION = 'notebooks';
export const NOTES_SUBCOLLECTION = 'notes';

/** How many notes the notes page reads. More than most learners will ever write. */
export const NOTES_PAGE_SIZE = 200;

/** A device clock this far ahead of the server is not trusted. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const noteSchema = z.object({
  course: z.enum(['de', 'gcp']),
  kind: z.enum(['lesson', 'problem', 'station', 'lab']),
  markdown: z.string().max(MAX_NOTE_CHARS),
  editedAt: z.iso.datetime(),
});

export type NoteDocument = z.infer<typeof noteSchema>;

/** A stored note, as the pages and the API see it. */
export interface StoredNote {
  key: string;
  markdown: string;
  editedAt: string;
}

/** A note with the chapter it belongs to, for the notes page. */
export interface NoteWithTarget extends StoredNote {
  target: NoteTarget;
}

/** Thrown when a key names no chapter. */
export class UnknownNoteTargetError extends Error {
  constructor() {
    super('That page does not take notes.');
    this.name = 'UnknownNoteTargetError';
  }
}

const repositories = new Map<string, Repository<NoteDocument>>();

/** The learner's notebook. Creating a repository opens no connection. */
function notebook(uid: string): Repository<NoteDocument> {
  let repository = repositories.get(uid);
  if (repository === undefined) {
    repository = createRepository({
      collection: `${NOTEBOOK_COLLECTION}/${uid}/${NOTES_SUBCOLLECTION}`,
      schema: noteSchema,
    });
    if (repositories.size > 1000) repositories.clear();
    repositories.set(uid, repository);
  }
  return repository;
}

/** The learner's note for one chapter, or null when they have not written one. */
export async function getNote(uid: string, key: string): Promise<StoredNote | null> {
  if (noteTarget(key) === undefined) return null;
  const note = await notebook(uid).get(key);
  return note === null ? null : { key, markdown: note.markdown, editedAt: note.editedAt };
}

/** Like `getNote`, but a read failure gives null, so a page still renders with an empty editor. */
export async function getNoteOrNull(uid: string, key: string): Promise<StoredNote | null> {
  try {
    return await getNote(uid, key);
  } catch (error) {
    logger.warn('Reading a note failed', {
      uid,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface SaveResult {
  /** `yours`: this save was written. `newer`: a later edit was already stored and kept. */
  kept: 'yours' | 'newer';
  note: StoredNote;
}

/** Saves the learner's note for a chapter. The newer edit wins. */
export async function saveNote(
  user: SessionUser,
  key: string,
  markdown: string,
  editedAt: string,
  now: Date,
): Promise<SaveResult> {
  const target = noteTarget(key);
  if (target === undefined) throw new UnknownNoteTargetError();

  // A device clock far in the future would make its edit win for ever.
  const latest = new Date(now.getTime() + MAX_CLOCK_SKEW_MS);
  const stamp = new Date(editedAt) > latest ? now.toISOString() : new Date(editedAt).toISOString();
  const payload: NoteDocument = {
    course: target.course,
    kind: target.kind,
    markdown,
    editedAt: stamp,
  };
  const repository = notebook(user.uid);

  const write = (): Promise<SaveResult> =>
    repository.runTransaction(async (repo) => {
      const existing = await repo.get(key);
      if (existing !== null && existing.editedAt > stamp) {
        return {
          kept: 'newer',
          note: { key, markdown: existing.markdown, editedAt: existing.editedAt },
        };
      }
      if (existing === null) repo.createWithId(key, payload, { minLength: 8 });
      else repo.update(key, { markdown, editedAt: stamp });
      return { kept: 'yours', note: { key, markdown, editedAt: stamp } };
    });

  let result: SaveResult;
  try {
    result = await write();
  } catch (error) {
    // Two first saves raced to create the document. It exists now, so the
    // retry takes the update path in a fresh transaction.
    if (!(error instanceof DocumentAlreadyExistsError)) throw error;
    result = await write();
  }

  logger.info('Note saved', { uid: user.uid, key, chars: markdown.length, kept: result.kept });
  return result;
}

/** The learner's notes, most recently edited first, with their chapters. Empty notes are left out. */
export async function listNotes(uid: string): Promise<{ notes: NoteWithTarget[]; more: boolean }> {
  const page = await notebook(uid).list({
    limit: NOTES_PAGE_SIZE,
    orderBy: [{ field: 'editedAt', direction: 'desc' }],
  });
  const notes = page.items.flatMap((note): NoteWithTarget[] => {
    const target = noteTarget(note.id);
    if (target === undefined || note.markdown.trim() === '') return [];
    return [{ key: note.id, markdown: note.markdown, editedAt: note.editedAt, target }];
  });
  return { notes, more: page.nextCursor !== null };
}
