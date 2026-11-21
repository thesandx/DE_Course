// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadRejectedError } from '@/lib/storage-paths';
import type { SessionUser } from '@/services/auth.service';

function unauthenticated(): Error {
  const error = new Error('Sign in to continue.');
  error.name = 'UnauthenticatedError';
  return error;
}

const USER = { uid: 'k3Jd8sLpQr2WxYz7Ab1Cd4Ef6Gh9' } as SessionUser;

const requireUser = vi.fn<() => Promise<SessionUser>>();
const getCurrentUser = vi.fn<() => Promise<SessionUser | null>>();
const saveNoteImage = vi.fn<(uid: string, bytes: Uint8Array) => Promise<string>>();
const noteImageUrl = vi.fn<(uid: string, id: string) => Promise<string>>();

vi.mock('@/services/auth.service', () => ({
  requireUser: () => requireUser(),
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock('@/services/note-image.service', () => ({
  saveNoteImage: (uid: string, bytes: Uint8Array) => saveNoteImage(uid, bytes),
  noteImageUrl: (uid: string, id: string) => noteImageUrl(uid, id),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');
const { GET } = await import('./[id]/route');

const ID = 'aB3dE5fG7hJ9kL1mN3pQ5rS7';

function post(type = 'image/jpeg', body: BodyInit = new Uint8Array([0xff, 0xd8, 0xff, 1])) {
  return new Request('http://localhost/api/notes/images', {
    method: 'POST',
    headers: { 'Content-Type': type },
    body,
  });
}

describe('POST /api/notes/images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    saveNoteImage.mockResolvedValue(ID);
  });

  it('stores the image under the session’s uid and answers with its id and path', async () => {
    const response = await POST(post());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ID, src: `/api/notes/images/${ID}` });
    expect(saveNoteImage.mock.calls[0]?.[0]).toBe(USER.uid);
  });

  it('refuses a signed-out caller, another type and a rejected image', async () => {
    requireUser.mockRejectedValueOnce(unauthenticated());
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post('image/svg+xml'))).status).toBe(415);
    saveNoteImage.mockRejectedValueOnce(new UploadRejectedError('Send the image as a JPEG.'));
    expect((await POST(post())).status).toBe(400);
  });
});

describe('GET /api/notes/images/<id>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(USER);
    noteImageUrl.mockResolvedValue('https://storage.example/signed');
  });

  const get = (id: string) =>
    GET(new Request(`http://localhost/api/notes/images/${id}`), {
      params: Promise.resolve({ id }),
    });

  it('redirects to a signed URL for the session’s own image', async () => {
    const response = await get(ID);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://storage.example/signed');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(noteImageUrl).toHaveBeenCalledWith(USER.uid, ID);
  });

  it('answers 404 for a malformed id and 401 without a session', async () => {
    expect((await get('..%2Fx')).status).toBe(404);
    getCurrentUser.mockResolvedValueOnce(null);
    expect((await get(ID)).status).toBe(401);
  });
});
