// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = `sk-or-v1-${'f0'.repeat(32)}`;
const envMock = vi.hoisted(() => ({
  env: { openrouterApiKey: '', appUrl: 'http://localhost:3000', appName: 'Loop Ready' },
}));
vi.mock('@/lib/env', () => envMock);
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { AssistantError, deltaFromEvent, streamAnswer } = await import('./openrouter.service');

function sse(lines: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split mid-line on purpose: the parser must join lines across chunks.
      const text = lines.join('\n');
      const middle = Math.floor(text.length / 2);
      controller.enqueue(encoder.encode(text.slice(0, middle)));
      controller.enqueue(encoder.encode(text.slice(middle)));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

const MESSAGES = [{ role: 'user' as const, content: 'Hi' }];

describe('deltaFromEvent', () => {
  it('reads the text of a chunk and skips everything else', () => {
    expect(deltaFromEvent('{"choices":[{"delta":{"content":"Hi"}}]}')).toBe('Hi');
    expect(deltaFromEvent('{"choices":[{"delta":{}}]}')).toBeNull();
    expect(deltaFromEvent('[DONE]')).toBeNull();
    expect(deltaFromEvent('not json')).toBeNull();
  });

  it('throws on an error inside the stream', () => {
    expect(() => deltaFromEvent('{"error":{"message":"overloaded"}}')).toThrow(AssistantError);
  });
});

describe('streamAnswer', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    envMock.env.openrouterApiKey = KEY;
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to call out without a key', async () => {
    envMock.env.openrouterApiKey = '';
    await expect(streamAnswer('m', MESSAGES, new AbortController().signal)).rejects.toMatchObject({
      reason: 'not_configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams the text and sends the key only in the header', async () => {
    fetchMock.mockResolvedValue(
      sse([
        ': OPENROUTER PROCESSING',
        'data: {"choices":[{"delta":{"content":"Window "}}]}',
        'data: {"choices":[{"delta":{"content":"functions"}}]}',
        'data: [DONE]',
        '',
      ]),
    );
    const stream = await streamAnswer(
      'anthropic/claude-haiku-5.5',
      MESSAGES,
      new AbortController().signal,
    );
    expect(await readAll(stream)).toBe('Window functions');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${KEY}`);
    expect(String(init?.body)).not.toContain(KEY);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'anthropic/claude-haiku-5.5',
      stream: true,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [401, 'not_configured'],
    [402, 'out_of_credits'],
    [429, 'busy'],
    [500, 'upstream'],
  ])('maps an OpenRouter %i to %s', async (status, reason) => {
    fetchMock.mockResolvedValue(new Response('{"error":{}}', { status }));
    await expect(streamAnswer('m', MESSAGES, new AbortController().signal)).rejects.toMatchObject({
      reason,
    });
  });
});
