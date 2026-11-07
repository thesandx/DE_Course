// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { MAX_STORIES, type StoryInput } from '@/lib/course/story-bank';
import type { SessionUser } from '@/services/auth.service';
import { getFirestore } from '@/services/firestore.client';
import {
  getStories,
  removeStory,
  saveStory,
  StoryBankFullError,
  StoryNotFoundError,
} from '@/services/story.service';

/**
 * The story bank against the real Firestore emulator: the transaction, the
 * first-save create path, the cap and the ownership of story ids. Skipped
 * without `FIRESTORE_EMULATOR_HOST`; run with `pnpm test:emulator`.
 */

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const describeEmulator = emulatorHost === '' ? describe.skip : describe;

function user(): SessionUser {
  // A fresh random uid per test, so tests never share a bank.
  const uid = crypto.randomUUID().replaceAll('-', '').slice(0, 28);
  return {
    uid,
    email: null,
    emailVerified: false,
    phoneNumber: null,
    displayName: null,
    photoUrl: null,
    signInProvider: 'google.com',
  };
}

const INPUT: StoryInput = {
  title: 'One metric for four teams',
  themes: ['influence', 'biggest-project'],
  situation: 'Four teams computed active riders four ways.',
  task: 'Nobody owned the definition.',
  action: 'I proposed one certified metric and found a sponsor.',
  result: 'All 4 teams moved in two quarters.',
  reflection: 'I would involve finance earlier.',
};

describeEmulator('story bank (emulator)', () => {
  afterAll(async () => {
    await getFirestore().terminate();
  });

  it('creates the bank on the first save and reads it back', async () => {
    const owner = user();
    expect(await getStories(owner.uid)).toEqual([]);

    const saved = await saveStory(owner, INPUT, new Date('2026-11-07T10:00:00.000Z'));
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);

    const stories = await getStories(owner.uid);
    expect(stories).toEqual([saved]);
  });

  it('replaces a story by id, newest save first', async () => {
    const owner = user();
    const first = await saveStory(owner, INPUT, new Date('2026-11-07T10:00:00.000Z'));
    await saveStory(owner, { ...INPUT, title: 'Second' }, new Date('2026-11-07T11:00:00.000Z'));
    await saveStory(
      owner,
      { ...INPUT, id: first.id, title: 'First, rewritten' },
      new Date('2026-11-07T12:00:00.000Z'),
    );

    const titles = (await getStories(owner.uid)).map((story) => story.title);
    expect(titles).toEqual(['First, rewritten', 'Second']);
  });

  it('refuses an id that is not in the caller’s bank', async () => {
    const owner = user();
    const stranger = user();
    const theirs = await saveStory(owner, INPUT, new Date());

    await expect(
      saveStory(stranger, { ...INPUT, id: theirs.id, title: 'Taken over' }, new Date()),
    ).rejects.toBeInstanceOf(StoryNotFoundError);
    await expect(removeStory(stranger, theirs.id)).rejects.toBeInstanceOf(StoryNotFoundError);
    expect((await getStories(owner.uid))[0]?.title).toBe(INPUT.title);
  });

  it('caps the bank and removes a story', async () => {
    const owner = user();
    const saved = [];
    for (let index = 0; index < MAX_STORIES; index += 1) {
      saved.push(await saveStory(owner, { ...INPUT, title: `Story ${index}` }, new Date()));
    }
    await expect(saveStory(owner, INPUT, new Date())).rejects.toBeInstanceOf(StoryBankFullError);

    const first = saved[0];
    if (first === undefined) throw new Error('no story saved');
    await removeStory(owner, first.id);
    expect(await getStories(owner.uid)).toHaveLength(MAX_STORIES - 1);
  });
});
