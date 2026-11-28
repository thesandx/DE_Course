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
  return new Request('http://localhost/api/mock/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const ANSWER =
  'Use an accumulating snapshot with one row per return line, and an event fact underneath for replay.';
const VALID = { slug: 'returns-accumulating-snapshot', answer: ANSWER, model: DEFAULT_MODEL_ID };

function modelSays(value: unknown): void {
  streamAnswer.mockResolvedValue(new Response(JSON.stringify(value)).body);
}

describe('POST /api/mock/grade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(USER);
    modelSays({
      covered: [
        { signal: 1, evidence: 'accumulating snapshot with one row per return line' },
        { signal: 4, evidence: 'handles reopened returns' },
      ],
      followUp: 'A return is refunded before pickup. What do your lag columns show?',
      summary: 'The grain is right. Skipped steps are missing.',
    });
  });

  it('grades with the signals from the catalogue and keeps only quoted evidence', async () => {
    const response = await POST(post(VALID));
    expect(response.status).toBe(200);
    const grade: unknown = await response.json();
    expect(grade).toEqual({
      covered: [{ signal: 0, evidence: 'accumulating snapshot with one row per return line' }],
      followUp: 'A return is refunded before pickup. What do your lag columns show?',
      summary: 'The grain is right. Skipped steps are missing.',
    });
    const sent = JSON.stringify(streamAnswer.mock.calls[0]?.[1]);
    expect(sent).toContain('Stores milestone dates and lag measures');
  });

  it('refuses a learner with no session', async () => {
    const error = new Error('Sign in to continue.');
    error.name = 'UnauthenticatedError';
    requireUser.mockRejectedValue(error);
    expect((await POST(post(VALID))).status).toBe(401);
    expect(streamAnswer).not.toHaveBeenCalled();
  });

  it('refuses an unknown problem, a problem with tests and a bad body', async () => {
    expect((await POST(post({ ...VALID, slug: 'no-such-problem' }))).status).toBe(404);
    expect((await POST(post({ ...VALID, slug: 'scd2-driver-city' }))).status).toBe(400);
    expect((await POST(post({ ...VALID, answer: '' }))).status).toBe(400);
    expect((await POST(post({ ...VALID, model: 'some/expensive-model' }))).status).toBe(400);
    expect((await POST(post('not json'))).status).toBe(400);
    expect(streamAnswer).not.toHaveBeenCalled();
  });

  it('says so when the model gives no usable grade', async () => {
    streamAnswer.mockResolvedValue(new Response('Sorry, I cannot help.').body);
    expect((await POST(post(VALID))).status).toBe(502);
  });

  it('turns an OpenRouter failure into a message the learner can act on', async () => {
    streamAnswer.mockRejectedValue(new FakeAssistantError('out_of_credits', 'no credit'));
    expect((await POST(post(VALID))).status).toBe(402);
  });

  it('slows down a learner who grades too much', async () => {
    requireUser.mockResolvedValue({ ...USER, uid: 'flood-uid-0000000000000000000' });
    const statuses: number[] = [];
    for (let index = 0; index < 31; index += 1) {
      modelSays({ covered: [], followUp: 'Why?', summary: 'Thin.' });
      statuses.push((await POST(post(VALID))).status);
    }
    expect(statuses[29]).toBe(200);
    expect(statuses[30]).toBe(429);
  });
});
