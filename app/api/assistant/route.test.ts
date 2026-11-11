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
const getNoteOrNull = vi.fn();

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
vi.mock('@/services/notes.service', () => ({
  getNoteOrNull: (...args: unknown[]) => getNoteOrNull(...args),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');

function post(body: unknown): Request {
  return new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID = {
  model: DEFAULT_MODEL_ID,
  path: '/de/tracks/sql/window-functions',
  messages: [{ role: 'user', content: 'Explain this simply' }],
};

function textStream(text: string): ReadableStream<Uint8Array> {
  return new Response(text).body ?? new ReadableStream();
}

describe('POST /api/assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    streamAnswer.mockResolvedValue(textStream('A window function looks at nearby rows.'));
    getNoteOrNull.mockResolvedValue(null);
  });

  it("reads the learner's own notes for the chapter", async () => {
    getNoteOrNull.mockResolvedValue({
      key: 'de:lesson:sql:window-functions',
      markdown: 'ROW_NUMBER ==dedups==',
      editedAt: '2026-11-11T10:00:00.000Z',
    });
    expect((await POST(post(VALID))).status).toBe(200);
    expect(getNoteOrNull).toHaveBeenCalledWith(USER.uid, 'de:lesson:sql:window-functions');
    const [, messages] = streamAnswer.mock.calls[0] ?? [];
    expect(JSON.stringify(messages)).toContain('ROW_NUMBER ==dedups==');
  });

  it('reads no notes on a page that has none', async () => {
    expect((await POST(post({ ...VALID, path: '/de' }))).status).toBe(200);
    expect(getNoteOrNull).not.toHaveBeenCalled();
    const [, messages] = streamAnswer.mock.calls[0] ?? [];
    expect(JSON.stringify(messages)).not.toContain('NOTES ON THIS PAGE');
  });

  it('answers a signed-in learner with the page as context', async () => {
    const response = await POST(post(VALID));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('A window function looks at nearby rows.');
    const [model, messages] = streamAnswer.mock.calls[0] ?? [];
    expect(model).toBe(DEFAULT_MODEL_ID);
    expect(JSON.stringify(messages)).toContain('LESSON TEXT');
  });

  it('refuses a learner with no session', async () => {
    const error = new Error('Sign in to continue.');
    error.name = 'UnauthenticatedError';
    requireUser.mockRejectedValue(error);
    expect((await POST(post(VALID))).status).toBe(401);
    expect(streamAnswer).not.toHaveBeenCalled();
  });

  it('refuses a bad body', async () => {
    expect((await POST(post('{'))).status).toBe(400);
    expect((await POST(post({ ...VALID, model: 'some/other-model' }))).status).toBe(400);
  });

  it('turns an OpenRouter failure into a message the learner can act on', async () => {
    streamAnswer.mockRejectedValue(
      new FakeAssistantError('out_of_credits', 'OpenRouter answered 402'),
    );
    const response = await POST(post(VALID));
    expect(response.status).toBe(402);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/credit/);
    expect(body.message).not.toContain('OpenRouter answered');
  });

  it('slows down a learner who asks too much', async () => {
    requireUser.mockResolvedValue({ ...USER, uid: 'flood-uid-0000000000000000000' });
    const statuses: number[] = [];
    for (let index = 0; index < 31; index += 1) statuses.push((await POST(post(VALID))).status);
    expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
