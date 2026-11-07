// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '@/services/auth.service';

const USER: SessionUser = {
  uid: 'k3Jd8sLpQr2WxYz7Ab1Cd4Ef6Gh9',
  email: null,
  emailVerified: false,
  phoneNumber: '+919876543210',
  displayName: null,
  photoUrl: null,
  signInProvider: 'phone',
};

const STORY_ID = '3f1c2b9e-8d4a-4f6b-9c2e-1a7d5e3b8f00';

const requireUser = vi.fn<() => Promise<SessionUser>>();
const saveStory = vi.fn();
const removeStory = vi.fn();

vi.mock('@/services/auth.service', () => ({ requireUser: () => requireUser() }));
vi.mock('@/services/story.service', () => ({
  saveStory: (...args: unknown[]) => saveStory(...args),
  removeStory: (...args: unknown[]) => removeStory(...args),
}));

const { DELETE, PUT } = await import('./route');

function put(body: unknown): Request {
  return new Request('http://localhost/api/stories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID = {
  title: 'One metric for four teams',
  themes: ['influence', 'biggest-project'],
  situation: 'Four teams computed active riders four ways.',
  task: 'Nobody owned it.',
  action: 'I proposed one certified metric.',
  result: 'All 4 teams moved.',
  reflection: 'Involve finance earlier.',
};

function unauthenticated(): Error {
  const error = new Error('Sign in to continue.');
  error.name = 'UnauthenticatedError';
  return error;
}

describe('PUT /api/stories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    saveStory.mockImplementation((_user: SessionUser, input: typeof VALID) => ({
      ...input,
      id: STORY_ID,
      updatedAt: '2026-11-07T10:00:00.000Z',
    }));
  });

  it('saves into the session user’s bank', async () => {
    const response = await PUT(put(VALID));
    expect(response.status).toBe(200);
    expect(saveStory).toHaveBeenCalledWith(USER, VALID, expect.any(Date));
    expect(await response.json()).toMatchObject({ id: STORY_ID, title: VALID.title });
  });

  it('answers 401 without a session', async () => {
    requireUser.mockRejectedValue(unauthenticated());
    const response = await PUT(put(VALID));
    expect(response.status).toBe(401);
    expect(saveStory).not.toHaveBeenCalled();
  });

  it('answers 400 for an invalid body or an identity field', async () => {
    for (const body of [
      { ...VALID, themes: [] },
      { ...VALID, uid: 'someone-else' },
    ]) {
      const response = await PUT(put(body));
      expect(response.status).toBe(400);
    }
    expect(saveStory).not.toHaveBeenCalled();
  });

  it('answers 409 when the bank is full', async () => {
    const error = new Error('A story bank holds at most 12 stories.');
    error.name = 'StoryBankFullError';
    saveStory.mockRejectedValue(error);
    const response = await PUT(put(VALID));
    expect(response.status).toBe(409);
  });
});

describe('DELETE /api/stories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    removeStory.mockResolvedValue(undefined);
  });

  const del = (query: string) =>
    new Request(`http://localhost/api/stories${query}`, { method: 'DELETE' });

  it('removes a story from the session user’s bank', async () => {
    const response = await DELETE(del(`?id=${STORY_ID}`));
    expect(response.status).toBe(204);
    expect(removeStory).toHaveBeenCalledWith(USER, STORY_ID);
  });

  it('answers 400 without a valid id', async () => {
    const response = await DELETE(del('?id=../../users'));
    expect(response.status).toBe(400);
    expect(removeStory).not.toHaveBeenCalled();
  });

  it('answers 404 for a story the caller does not have', async () => {
    const error = new Error('That story is not in your story bank.');
    error.name = 'StoryNotFoundError';
    removeStory.mockRejectedValue(error);
    const response = await DELETE(del(`?id=${STORY_ID}`));
    expect(response.status).toBe(404);
  });

  it('answers 401 without a session', async () => {
    requireUser.mockRejectedValue(unauthenticated());
    const response = await DELETE(del(`?id=${STORY_ID}`));
    expect(response.status).toBe(401);
  });
});
