// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import type { TextHighlight } from '@/lib/notes/highlights';
import type { SessionUser } from '@/services/auth.service';
import { getFirestore } from '@/services/firestore.client';
import { getHighlights, saveHighlights } from '@/services/highlights.service';
import { UnknownNoteTargetError } from '@/services/notes.service';

/**
 * Text highlights against the real Firestore emulator: the first-save create
 * path, the newer-change-wins rule and the clock guard.
 * Skipped without `FIRESTORE_EMULATOR_HOST`; run with `pnpm test:emulator`.
 */

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const describeEmulator = emulatorHost === '' ? describe.skip : describe;

const LESSON = 'de:lesson:sql:window-functions';

function user(): SessionUser {
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

function item(text: string): TextHighlight {
  return {
    id: crypto.randomUUID().replaceAll('-', '').slice(0, 16),
    scope: 'body',
    text,
    prefix: '',
    suffix: '',
    color: 'neon',
    at: '2026-11-27T10:00:00.000Z',
  };
}

describeEmulator('text highlights (emulator)', () => {
  afterAll(async () => {
    await getFirestore().terminate();
  });

  it('creates the list on the first save and replaces it after', async () => {
    const learner = user();
    expect(await getHighlights(learner.uid, LESSON)).toBeNull();

    const first = await saveHighlights(
      learner,
      LESSON,
      [item('ROW_NUMBER')],
      '2026-11-27T10:00:00.000Z',
      new Date('2026-11-27T10:00:01.000Z'),
    );
    expect(first.kept).toBe('yours');

    const second = await saveHighlights(
      learner,
      LESSON,
      [],
      '2026-11-27T10:05:00.000Z',
      new Date('2026-11-27T10:05:01.000Z'),
    );
    expect(second.kept).toBe('yours');
    expect((await getHighlights(learner.uid, LESSON))?.items).toEqual([]);
  });

  it('keeps the newer change when an older save arrives', async () => {
    const learner = user();
    const newer = [item('shuffle')];
    await saveHighlights(
      learner,
      LESSON,
      newer,
      '2026-11-27T11:00:00.000Z',
      new Date('2026-11-27T11:00:01.000Z'),
    );
    const late = await saveHighlights(
      learner,
      LESSON,
      [],
      '2026-11-27T10:00:00.000Z',
      new Date('2026-11-27T11:00:02.000Z'),
    );
    expect(late.kept).toBe('newer');
    expect(late.highlights.items).toEqual(newer);
  });

  it('does not trust a clock far in the future, and refuses an unknown page', async () => {
    const learner = user();
    const now = new Date('2026-11-27T12:00:00.000Z');
    const result = await saveHighlights(learner, LESSON, [], '2030-01-01T00:00:00.000Z', now);
    expect(result.highlights.editedAt).toBe(now.toISOString());
    await expect(
      saveHighlights(learner, 'de:lesson:sql:not-a-lesson', [], now.toISOString(), now),
    ).rejects.toBeInstanceOf(UnknownNoteTargetError);
  });
});
