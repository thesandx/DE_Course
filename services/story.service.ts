import 'server-only';

import { z } from 'zod';

import { MAX_STORIES, type Story, type StoryInput, storySchema } from '@/lib/course/story-bank';
import { logger } from '@/lib/logger';
import type { SessionUser } from '@/services/auth.service';
import { createRepository, DocumentAlreadyExistsError } from '@/services/repository';

/**
 * Behavioral story banks — `story-banks/{uid}`, one document per learner.
 *
 * ## Why one document, not a collection of stories
 *
 * The only read is "all of my stories", on one page. The bank is bounded by
 * `MAX_STORIES` (12) and each story by `MAX_FIELD_LENGTH` per field, so the
 * document stays under about 150 KB, far below the 1 MiB limit. One document
 * makes the read one key lookup with no query and no index, and a save is a
 * transaction on one document. It is keyed by the Firebase uid for the same
 * reason as `users/{uid}` (see `services/user.service.ts`).
 *
 * It is a separate collection from `learners/{uid}` because that document is
 * read on every course page, and stories are read on one page only.
 *
 * Nothing queries inside `stories`, so `firestore.indexes.json` exempts it.
 *
 * ## Removing a story
 *
 * A learner removes their own draft text from the array. That is an update of
 * one document, not a document delete. Point-in-time recovery still covers it
 * (see docs/data-recovery.md).
 */

export const STORY_BANK_COLLECTION = 'story-banks';

export const storyBankSchema = z.object({
  stories: z.array(storySchema).max(MAX_STORIES),
});

export const storyBanks = createRepository({
  collection: STORY_BANK_COLLECTION,
  schema: storyBankSchema,
});

/** Thrown when a save would take the bank over `MAX_STORIES`. */
export class StoryBankFullError extends Error {
  constructor() {
    super(`A story bank holds at most ${MAX_STORIES} stories. Remove one to add another.`);
    this.name = 'StoryBankFullError';
  }
}

/** Thrown when a save or remove names a story the caller does not have. */
export class StoryNotFoundError extends Error {
  constructor() {
    super('That story is not in your story bank.');
    this.name = 'StoryNotFoundError';
  }
}

/** The caller's stories, newest save first. */
export async function getStories(uid: string): Promise<Story[]> {
  const bank = await storyBanks.get(uid);
  if (bank === null) return [];
  return [...bank.stories].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Applies `change` to the caller's bank in a transaction; two tabs may save at once. */
async function writeBank(
  user: SessionUser,
  change: (before: Story[]) => Story[],
): Promise<Story[]> {
  const write = (): Promise<Story[]> =>
    storyBanks.runTransaction(async (repo) => {
      const existing = await repo.get(user.uid);
      const after = change(existing?.stories ?? []);
      if (existing === null) repo.createWithId(user.uid, { stories: after });
      else repo.update(user.uid, { stories: after });
      return after;
    });

  try {
    return await write();
  } catch (error) {
    // Two first saves raced to create the document. It exists now, so the
    // retry takes the update path in a fresh transaction.
    if (!(error instanceof DocumentAlreadyExistsError)) throw error;
    return write();
  }
}

/**
 * Creates or replaces one story. A new story gets a random id from the
 * server; an existing one must already be in the caller's bank, so a caller
 * cannot write into an id it does not own.
 */
export async function saveStory(user: SessionUser, input: StoryInput, now: Date): Promise<Story> {
  const { id, ...fields } = input;
  const story: Story = { ...fields, id: id ?? crypto.randomUUID(), updatedAt: now.toISOString() };

  await writeBank(user, (before) => {
    if (id === undefined) {
      if (before.length >= MAX_STORIES) throw new StoryBankFullError();
      return [...before, story];
    }
    if (!before.some((item) => item.id === id)) throw new StoryNotFoundError();
    return before.map((item) => (item.id === id ? story : item));
  });

  logger.info('Story saved', { uid: user.uid, storyId: story.id, created: id === undefined });
  return story;
}

/** Removes one story from the caller's bank. */
export async function removeStory(user: SessionUser, id: string): Promise<void> {
  await writeBank(user, (before) => {
    if (!before.some((item) => item.id === id)) throw new StoryNotFoundError();
    return before.filter((item) => item.id !== id);
  });
  logger.info('Story removed', { uid: user.uid, storyId: id });
}
