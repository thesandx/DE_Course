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
const getHighlights = vi.fn();
const saveHighlights = vi.fn();

vi.mock('@/services/auth.service', () => ({ requireUser: () => requireUser() }));
vi.mock('@/services/highlights.service', () => ({
  getHighlights: (...args: unknown[]) => getHighlights(...args),
  saveHighlights: (...args: unknown[]) => saveHighlights(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { GET, PUT } = await import('./route');

const KEY = 'de:lesson:sql:window-functions';
const ITEM = {
  id: 'a1b2c3d4e5f6a7b8',
  scope: 'body',
  text: 'ROW_NUMBER',
  prefix: 'Use ',
  suffix: ' once',
  color: 'neon',
  at: '2026-11-27T10:00:00.000Z',
};
const VALID = { key: KEY, items: [ITEM], editedAt: '2026-11-27T10:00:00.000Z' };

function put(body: unknown): Request {
  return new Request('http://localhost/api/notes/highlights', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function unauthenticated(): Error {
  const error = new Error('Sign in to continue.');
  error.name = 'UnauthenticatedError';
  return error;
}

describe('GET /api/notes/highlights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
  });

  it("reads the session's own highlights", async () => {
    getHighlights.mockResolvedValue({ key: KEY, items: [ITEM], editedAt: VALID.editedAt });
    const response = await GET(new Request(`http://localhost/api/notes/highlights?key=${KEY}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ highlights: { items: [ITEM] } });
    expect(getHighlights).toHaveBeenCalledWith(USER.uid, KEY);
  });

  it('refuses a bad key and a missing session', async () => {
    expect((await GET(new Request('http://localhost/api/notes/highlights?key=x'))).status).toBe(
      400,
    );
    requireUser.mockRejectedValue(unauthenticated());
    expect(
      (await GET(new Request(`http://localhost/api/notes/highlights?key=${KEY}`))).status,
    ).toBe(401);
    expect(getHighlights).not.toHaveBeenCalled();
  });
});

describe('PUT /api/notes/highlights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    saveHighlights.mockImplementation(
      (_user: SessionUser, key: string, items: unknown[], editedAt: string) => ({
        kept: 'yours',
        highlights: { key, items, editedAt },
      }),
    );
  });

  it("saves the list to the session's own highlights", async () => {
    const response = await PUT(put(VALID));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ kept: 'yours' });
    expect(saveHighlights).toHaveBeenCalledWith(
      USER,
      KEY,
      [ITEM],
      VALID.editedAt,
      expect.any(Date),
    );
  });

  it('refuses a missing session', async () => {
    requireUser.mockRejectedValue(unauthenticated());
    expect((await PUT(put(VALID))).status).toBe(401);
    expect(saveHighlights).not.toHaveBeenCalled();
  });

  it('refuses a uid, a bad colour, a long quote, too many items and bad JSON', async () => {
    expect((await PUT(put({ ...VALID, uid: 'someone-else' }))).status).toBe(400);
    expect((await PUT(put({ ...VALID, items: [{ ...ITEM, color: 'red' }] }))).status).toBe(400);
    expect(
      (await PUT(put({ ...VALID, items: [{ ...ITEM, text: 'x'.repeat(1001) }] }))).status,
    ).toBe(400);
    expect((await PUT(put({ ...VALID, items: Array(201).fill(ITEM) }))).status).toBe(400);
    expect((await PUT(put('{'))).status).toBe(400);
    expect(saveHighlights).not.toHaveBeenCalled();
  });
});
