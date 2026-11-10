import 'server-only';

import type { ModelMessage } from '@/lib/assistant/chat';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * OpenRouter, for the AI doubt assistant. One call: stream a chat answer.
 *
 * The key never leaves this file. It is read from `env` (Secret Manager in
 * production), sent in the `Authorization` header, and never logged. The
 * browser talks only to `POST /api/assistant`, never to OpenRouter.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** The whole answer must arrive within this. A stuck model must not hold a Cloud Run request. */
const ANSWER_TIMEOUT_MS = 90_000;

/** Caps one answer's length, which caps its cost. About 900 words. */
const MAX_ANSWER_TOKENS = 1_200;

/** Why the assistant could not answer. The route maps `reason` to a status and a message. */
export type AssistantFailure = 'not_configured' | 'out_of_credits' | 'busy' | 'upstream';

export class AssistantError extends Error {
  readonly reason: AssistantFailure;

  constructor(reason: AssistantFailure, detail: string) {
    super(detail);
    this.name = 'AssistantError';
    this.reason = reason;
  }
}

function failureFor(status: number): AssistantFailure {
  if (status === 401 || status === 403) return 'not_configured';
  if (status === 402) return 'out_of_credits';
  if (status === 429) return 'busy';
  return 'upstream';
}

/** The text in one `data:` line of OpenRouter's stream, or `null` for none. */
export function deltaFromEvent(data: string): string | null {
  if (data === '[DONE]') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    // A partial or non-JSON line carries no text; the stream goes on.
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  if ('error' in parsed) {
    throw new AssistantError(
      'upstream',
      `OpenRouter stream error: ${JSON.stringify(parsed.error)}`,
    );
  }
  if (!('choices' in parsed) || !Array.isArray(parsed.choices)) return null;
  const choice: unknown = parsed.choices[0];
  if (typeof choice !== 'object' || choice === null || !('delta' in choice)) return null;
  const delta: unknown = choice.delta;
  if (typeof delta !== 'object' || delta === null || !('content' in delta)) return null;
  return typeof delta.content === 'string' ? delta.content : null;
}

/**
 * Asks a model and returns a stream of the answer's text, as UTF-8 bytes.
 *
 * Throws `AssistantError` before the stream starts when OpenRouter refuses
 * the request. `signal` is the browser's request: when the learner closes the
 * panel or presses Stop, the call to OpenRouter stops too, and so does the bill.
 */
export async function streamAnswer(
  model: string,
  messages: readonly ModelMessage[],
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  if (env.openrouterApiKey === '') {
    throw new AssistantError('not_configured', 'OPENROUTER_API_KEY is not set');
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openrouterApiKey}`,
      'Content-Type': 'application/json',
      // OpenRouter shows these on its dashboard, so the spend is easy to trace.
      'HTTP-Referer': env.appUrl,
      'X-Title': env.appName,
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: MAX_ANSWER_TOKENS }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(ANSWER_TIMEOUT_MS)]),
  });

  if (!response.ok || response.body === null) {
    const detail = await response.text().catch(() => '');
    throw new AssistantError(
      failureFor(response.status),
      `OpenRouter answered ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = response.body.getReader();
  let buffer = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          let text = '';
          for (const line of lines) {
            // Lines starting with ":" are OpenRouter's keep-alive comments.
            if (!line.startsWith('data:')) continue;
            text += deltaFromEvent(line.slice(5).trim()) ?? '';
          }
          if (text !== '') {
            controller.enqueue(encoder.encode(text));
            return;
          }
        }
      } catch (error) {
        logger.warn('The assistant stream stopped early', {
          error: error instanceof Error ? error.message : String(error),
        });
        controller.error(error);
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}
