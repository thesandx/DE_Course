// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '@/services/auth.service';

const USER: SessionUser = {
  uid: 'k3Jd8sLpQr2WxYz7Ab1Cd4Ef6Gh9',
  email: null,
  emailVerified: false,
  phoneNumber: null,
  displayName: null,
  photoUrl: null,
  signInProvider: 'google.com',
};

const requireUser = vi.fn<() => Promise<SessionUser>>();
const saveNote = vi.fn();

vi.mock('@/services/auth.service', () => ({ requireUser: () => requireUser() }));
vi.mock('@/services/notes.service', () => ({
  saveNote: (...args: unknown[]) => saveNote(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { PUT } = await import('./route');

function put(body: unknown): Request {
  return new Request('http://localhost/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID = {
  key: 'de:lesson:sql:window-functions',
  markdown: '## Dedup\n\n- ==ROW_NUMBER== then `rn = 1`',
  editedAt: '2026-11-11T10:00:00.000Z',
};

describe('PUT /api/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    saveNote.mockImplementation(
      (_user: SessionUser, key: string, markdown: string, editedAt: string) => ({
        kept: 'yours',
        note: { key, markdown, editedAt },
      }),
    );
  });

  it("saves the note to the session's own notebook", async () => {
    const response = await PUT(put(VALID));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ kept: 'yours' });
    expect(saveNote).toHaveBeenCalledWith(
      USER,
      VALID.key,
      VALID.markdown,
      VALID.editedAt,
      expect.any(Date),
    );
  });

  it('refuses a learner with no session', async () => {
    const error = new Error('Sign in to continue.');
    error.name = 'UnauthenticatedError';
    requireUser.mockRejectedValue(error);
    expect((await PUT(put(VALID))).status).toBe(401);
    expect(saveNote).not.toHaveBeenCalled();
  });

  it('refuses a uid, a bad key, a long note and bad JSON', async () => {
    expect((await PUT(put({ ...VALID, uid: 'someone-else' }))).status).toBe(400);
    expect((await PUT(put({ ...VALID, key: 'users/other' }))).status).toBe(400);
    expect((await PUT(put({ ...VALID, markdown: 'x'.repeat(20_001) }))).status).toBe(400);
    expect((await PUT(put('{'))).status).toBe(400);
    expect(saveNote).not.toHaveBeenCalled();
  });

  it('says so when the key names no chapter', async () => {
    const error = new Error('That page does not take notes.');
    error.name = 'UnknownNoteTargetError';
    saveNote.mockRejectedValue(error);
    const response = await PUT(put({ ...VALID, key: 'de:lesson:sql:no-such-lesson' }));
    expect(response.status).toBe(400);
  });
});
