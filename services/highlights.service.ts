import 'server-only';

import { z } from 'zod';

import type { TextHighlight } from '@/lib/notes/highlights';
import { textHighlightsSchema } from '@/lib/notes/schema';
import { noteTarget } from '@/lib/notes/targets';
import type { SessionUser } from '@/services/auth.service';
import { UnknownNoteTargetError } from '@/services/notes.service';
import {
  createRepository,
  DocumentAlreadyExistsError,
  type Repository,
} from '@/services/repository';

/**
 * Highlights on the course text — `notebooks/{uid}/highlights/{key}`, one
 * document per chapter, next to the chapter's note.
 *
 * ## Why one document per chapter, with a bounded array
 *
 * A page shows all of its highlights at once, so they are read together: one
 * key lookup, no query. The array is capped at `MAX_HIGHLIGHTS` (200 short
 * quotes, well under the 1 MiB document limit), so it cannot grow without
 * bound. The id is the chapter's key, checked against the catalogue, exactly
 * as for notes (see `services/notes.service.ts`).
 *
 * ## Two devices
 *
 * The browser sends the whole list with `editedAt`, when the learner last
 * changed a highlight. The newer change wins, and an older save gets the
 * stored list back, so the device adopts it.
 *
 * ## Removing a highlight
 *
 * Removing one saves the list without it. The document is never deleted.
 */

export const HIGHLIGHTS_SUBCOLLECTION = 'highlights';

/** A device clock this far ahead of the server is not trusted. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const highlightsSchema = z.object({
  course: z.enum(['de', 'gcp', 'k8s']),
  kind: z.enum(['lesson', 'problem', 'track', 'station', 'lab']),
  items: textHighlightsSchema,
  editedAt: z.iso.datetime(),
});

export type HighlightsDocument = z.infer<typeof highlightsSchema>;

/** A page's stored highlights, as the API sees them. */
export interface StoredHighlights {
  key: string;
  items: TextHighlight[];
  editedAt: string;
}

export interface SaveHighlightsResult {
  /** `yours`: this save was written. `newer`: a later change was already stored and kept. */
  kept: 'yours' | 'newer';
  highlights: StoredHighlights;
}

const repositories = new Map<string, Repository<HighlightsDocument>>();

/** The learner's highlights. Creating a repository opens no connection. */
function highlightBook(uid: string): Repository<HighlightsDocument> {
  let repository = repositories.get(uid);
  if (repository === undefined) {
    repository = createRepository({
      collection: `notebooks/${uid}/${HIGHLIGHTS_SUBCOLLECTION}`,
      schema: highlightsSchema,
    });
    if (repositories.size > 1000) repositories.clear();
    repositories.set(uid, repository);
  }
  return repository;
}

/** The learner's highlights on one page, or null when they have made none. */
export async function getHighlights(uid: string, key: string): Promise<StoredHighlights | null> {
  if (noteTarget(key) === undefined) throw new UnknownNoteTargetError();
  const stored = await highlightBook(uid).get(key);
  return stored === null ? null : { key, items: stored.items, editedAt: stored.editedAt };
}

/** Saves every highlight on one page. The newer change wins. */
export async function saveHighlights(
  user: SessionUser,
  key: string,
  items: TextHighlight[],
  editedAt: string,
  now: Date,
): Promise<SaveHighlightsResult> {
  const target = noteTarget(key);
  if (target === undefined) throw new UnknownNoteTargetError();

  // A device clock far in the future would make its change win for ever.
  const latest = new Date(now.getTime() + MAX_CLOCK_SKEW_MS);
  const stamp = new Date(editedAt) > latest ? now.toISOString() : new Date(editedAt).toISOString();
  const payload: HighlightsDocument = {
    course: target.course,
    kind: target.kind,
    items,
    editedAt: stamp,
  };
  const repository = highlightBook(user.uid);

  const write = (): Promise<SaveHighlightsResult> =>
    repository.runTransaction(async (repo) => {
      const existing = await repo.get(key);
      if (existing !== null && existing.editedAt > stamp) {
        return {
          kept: 'newer',
          highlights: { key, items: existing.items, editedAt: existing.editedAt },
        };
      }
      if (existing === null) repo.createWithId(key, payload, { minLength: 8 });
      else repo.update(key, { items, editedAt: stamp });
      return { kept: 'yours', highlights: { key, items, editedAt: stamp } };
    });

  try {
    return await write();
  } catch (error) {
    // Two first saves raced to create the document. It exists now, so the
    // retry takes the update path in a fresh transaction.
    if (!(error instanceof DocumentAlreadyExistsError)) throw error;
    return await write();
  }
}
