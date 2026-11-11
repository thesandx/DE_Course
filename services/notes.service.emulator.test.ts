// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import type { SessionUser } from '@/services/auth.service';
import { getFirestore } from '@/services/firestore.client';
import { getNote, listNotes, saveNote, UnknownNoteTargetError } from '@/services/notes.service';

/**
 * Chapter notes against the real Firestore emulator: the first-save create
 * path, the newer-edit-wins rule, the clock guard and the listing (which
 * needs the composite index in firestore.indexes.json in production).
 * Skipped without `FIRESTORE_EMULATOR_HOST`; run with `pnpm test:emulator`.
 */

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const describeEmulator = emulatorHost === '' ? describe.skip : describe;

const LESSON = 'de:lesson:sql:window-functions';
const PROBLEM_KEY = 'de:problem:ad-clicks-dedup-ctr';

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

describeEmulator('chapter notes (emulator)', () => {
  afterAll(async () => {
    await getFirestore().terminate();
  });

  it('creates a note on the first save and updates it after', async () => {
    const owner = user();
    expect(await getNote(owner.uid, LESSON)).toBeNull();

    const now = new Date('2026-11-11T10:00:00.000Z');
    const first = await saveNote(owner, LESSON, 'first', '2026-11-11T09:59:00.000Z', now);
    expect(first.kept).toBe('yours');
    const second = await saveNote(owner, LESSON, '==second==', '2026-11-11T10:00:00.000Z', now);
    expect(second.kept).toBe('yours');
    expect(await getNote(owner.uid, LESSON)).toEqual({
      key: LESSON,
      markdown: '==second==',
      editedAt: '2026-11-11T10:00:00.000Z',
    });
  });

  it('keeps the newer edit when an older one arrives late', async () => {
    const owner = user();
    const now = new Date('2026-11-11T10:00:00.000Z');
    await saveNote(owner, LESSON, 'from the laptop', '2026-11-11T09:58:00.000Z', now);
    const late = await saveNote(
      owner,
      LESSON,
      'from the phone, offline',
      '2026-11-11T09:50:00.000Z',
      now,
    );
    expect(late.kept).toBe('newer');
    expect(late.note.markdown).toBe('from the laptop');
    expect((await getNote(owner.uid, LESSON))?.markdown).toBe('from the laptop');
  });

  it('does not trust a device clock far in the future', async () => {
    const owner = user();
    const now = new Date('2026-11-11T10:00:00.000Z');
    const saved = await saveNote(owner, LESSON, 'x', '2030-01-01T00:00:00.000Z', now);
    expect(saved.note.editedAt).toBe(now.toISOString());
  });

  it('refuses a key that names no chapter', async () => {
    await expect(
      saveNote(user(), 'de:lesson:sql:no-such', 'x', '2026-11-11T10:00:00.000Z', new Date()),
    ).rejects.toBeInstanceOf(UnknownNoteTargetError);
  });

  it('lists notes newest first, and only the owner’s, without empty ones', async () => {
    const owner = user();
    const other = user();
    const now = new Date('2026-11-11T10:00:00.000Z');
    await saveNote(owner, LESSON, 'older', '2026-11-11T09:00:00.000Z', now);
    await saveNote(owner, PROBLEM_KEY, 'newer', '2026-11-11T09:30:00.000Z', now);
    await saveNote(owner, 'gcp:station:visualization', '', '2026-11-11T09:40:00.000Z', now).catch(
      () => undefined,
    );
    await saveNote(other, LESSON, 'not yours', '2026-11-11T09:45:00.000Z', now);

    const { notes } = await listNotes(owner.uid);
    expect(notes.map((note) => note.markdown)).toEqual(['newer', 'older']);
    expect(notes[0]?.target.kind).toBe('problem');
  });
});
