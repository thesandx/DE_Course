// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '@/services/auth.service';

const USER: SessionUser = {
  uid: 'k3Jd8sLpQr2WxYz7Ab1Cd4Ef6Gh9',
  email: null,
  emailVerified: false,
  phoneNumber: null,
  displayName: 'Learner',
  photoUrl: null,
  signInProvider: 'google.com',
};

const requireUser = vi.fn<() => Promise<SessionUser>>();
const recordStudyTime = vi.fn();

vi.mock('@/services/auth.service', () => ({ requireUser: () => requireUser() }));
vi.mock('@/services/progress.service', () => ({
  recordStudyTime: (...args: unknown[]) => recordStudyTime(...args),
}));

const { POST } = await import('./route');

function post(body: unknown): Request {
  return new Request('http://localhost/api/study-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/study-time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    recordStudyTime.mockResolvedValue(undefined);
  });

  it('adds the seconds to the session user’s local day', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const response = await POST(post({ seconds: 60, day }));
    expect(response.status).toBe(204);
    expect(recordStudyTime).toHaveBeenCalledWith(USER, day, 60);
  });

  it('replaces a day far from the server clock with today', async () => {
    await POST(post({ seconds: 60, day: '2001-01-01' }));
    expect(recordStudyTime).toHaveBeenCalledWith(USER, new Date().toISOString().slice(0, 10), 60);
  });

  it('refuses a report that is too large, empty or not JSON', async () => {
    expect((await POST(post({ seconds: 301 }))).status).toBe(400);
    expect((await POST(post({ seconds: 0 }))).status).toBe(400);
    expect((await POST(post('not json'))).status).toBe(400);
    expect(recordStudyTime).not.toHaveBeenCalled();
  });

  it('needs a session', async () => {
    const error = new Error('Sign in to continue.');
    error.name = 'UnauthenticatedError';
    requireUser.mockRejectedValue(error);
    expect((await POST(post({ seconds: 60 }))).status).toBe(401);
    expect(recordStudyTime).not.toHaveBeenCalled();
  });
});
