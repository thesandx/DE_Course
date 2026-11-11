// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MODEL_ID } from '@/lib/assistant/models';
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
const streamAnswer = vi.fn();

class FakeAssistantError extends Error {
  constructor(
    readonly reason: string,
    detail: string,
  ) {
    super(detail);
    this.name = 'AssistantError';
  }
}

vi.mock('@/services/auth.service', () => ({ requireUser: () => requireUser() }));
vi.mock('@/services/openrouter.service', () => ({
  AssistantError: FakeAssistantError,
  streamAnswer: (...args: unknown[]) => streamAnswer(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');

function post(body: unknown): Request {
  return new Request('http://localhost/api/notes/format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID = {
  key: 'de:lesson:sql:window-functions',
  markdown: 'row number dedup, partition by key',
  mode: 'tidy',
  model: DEFAULT_MODEL_ID,
};

describe('POST /api/notes/format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    streamAnswer.mockResolvedValue(new Response('## Dedup\n\n- ==ROW_NUMBER==').body);
  });

  it("streams Pip's formatted copy of the note", async () => {
    const response = await POST(post(VALID));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('## Dedup\n\n- ==ROW_NUMBER==');
    const [model, messages, , options] = streamAnswer.mock.calls[0] ?? [];
    expect(model).toBe(DEFAULT_MODEL_ID);
    expect(JSON.stringify(messages)).toContain('row number dedup');
    expect(options).toMatchObject({ maxTokens: expect.any(Number) });
  });

  it('refuses a learner with no session', async () => {
    const error = new Error('Sign in to continue.');
    error.name = 'UnauthenticatedError';
    requireUser.mockRejectedValue(error);
    expect((await POST(post(VALID))).status).toBe(401);
    expect(streamAnswer).not.toHaveBeenCalled();
  });

  it('refuses an empty note, a custom mode with no instruction and an unknown chapter', async () => {
    expect((await POST(post({ ...VALID, markdown: '  ' }))).status).toBe(400);
    expect((await POST(post({ ...VALID, mode: 'custom' }))).status).toBe(400);
    expect((await POST(post({ ...VALID, key: 'de:lesson:sql:nope' }))).status).toBe(400);
    expect((await POST(post({ ...VALID, model: 'some/expensive-model' }))).status).toBe(400);
    expect(streamAnswer).not.toHaveBeenCalled();
  });

  it('turns an OpenRouter failure into a message the learner can act on', async () => {
    streamAnswer.mockRejectedValue(new FakeAssistantError('not_configured', 'no key'));
    const response = await POST(post(VALID));
    expect(response.status).toBe(503);
  });

  it('slows down a learner who formats too much', async () => {
    requireUser.mockResolvedValue({ ...USER, uid: 'flood-uid-0000000000000000000' });
    const statuses: number[] = [];
    for (let index = 0; index < 13; index += 1) {
      streamAnswer.mockResolvedValue(new Response('ok').body);
      statuses.push((await POST(post(VALID))).status);
    }
    expect(statuses[12]).toBe(429);
  });
});
