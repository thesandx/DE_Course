/**
 * Highlights on the course text itself — the learner selects a passage in a
 * lesson and marks it, like a highlighter on a printed page.
 *
 * ## How a highlight finds its text again
 *
 * A highlight is stored as the text it covers, plus a few characters on each
 * side (a "text quote" anchor). It is not stored as a DOM path or a character
 * offset, because both break when a lesson is edited a little. To show it,
 * `locateHighlight` looks for the quote in the section's text, and the
 * context on each side picks the right copy when the quote occurs twice. When
 * the quote is gone, the highlight is not shown; nothing breaks.
 *
 * Pure: no DOM, no I/O. `lib/notes/text-ranges.ts` maps offsets to the page.
 */

import type { HighlightColor } from '@/lib/notes/markdown';

/** Highlights one page keeps. Far more than a learner marks on one chapter. */
export const MAX_HIGHLIGHTS = 200;

/** The longest passage one highlight covers: about two paragraphs. */
export const MAX_HIGHLIGHT_CHARS = 1_000;

/** Context kept on each side of the quote, to tell two copies apart. */
export const CONTEXT_CHARS = 32;

/** The section names a page uses, such as `body`, `prompt` or `concept-2`. */
export const HIGHLIGHT_SCOPE_PATTERN = /^[a-z0-9-]{1,40}$/;

/** The colour a new highlight takes when the learner does not pick one. */
export const DEFAULT_TEXT_HIGHLIGHT: HighlightColor = 'neon';

export interface TextHighlight {
  /** Random, made on the device. */
  id: string;
  /** The section of the page the text is in. */
  scope: string;
  text: string;
  prefix: string;
  suffix: string;
  color: HighlightColor;
  /** When the learner made it (ISO 8601). */
  at: string;
}

export interface TextSpan {
  start: number;
  end: number;
}

const SPACE = /\s/;

/** Moves a span in past white space at either end. Null when nothing is left. */
export function trimSpan(text: string, start: number, end: number): TextSpan | null {
  let from = Math.max(0, Math.min(start, end));
  let to = Math.min(text.length, Math.max(start, end));
  while (from < to && SPACE.test(text[from] ?? '')) from += 1;
  while (to > from && SPACE.test(text[to - 1] ?? '')) to -= 1;
  return from < to ? { start: from, end: to } : null;
}

/** The anchor for the span `start..end` of a section's text. */
export function anchorFor(
  text: string,
  span: TextSpan,
): Pick<TextHighlight, 'text' | 'prefix' | 'suffix'> {
  return {
    text: text.slice(span.start, span.end),
    prefix: text.slice(Math.max(0, span.start - CONTEXT_CHARS), span.start),
    suffix: text.slice(span.end, span.end + CONTEXT_CHARS),
  };
}

/** How many characters two strings share at their ends (`fromEnd`) or starts. */
function sharedLength(a: string, b: string, fromEnd: boolean): number {
  const length = Math.min(a.length, b.length);
  let count = 0;
  while (count < length) {
    const left = fromEnd ? a[a.length - 1 - count] : a[count];
    const right = fromEnd ? b[b.length - 1 - count] : b[count];
    if (left !== right) break;
    count += 1;
  }
  return count;
}

/** Where a highlight's quote is in a section's text, or null when it is gone. */
export function locateHighlight(
  text: string,
  highlight: Pick<TextHighlight, 'text' | 'prefix' | 'suffix'>,
): TextSpan | null {
  const quote = highlight.text;
  if (quote === '') return null;
  let best: TextSpan | null = null;
  let bestScore = -1;
  let from = text.indexOf(quote);
  while (from !== -1) {
    const end = from + quote.length;
    const score =
      sharedLength(text.slice(Math.max(0, from - CONTEXT_CHARS), from), highlight.prefix, true) +
      sharedLength(text.slice(end, end + CONTEXT_CHARS), highlight.suffix, false);
    if (score > bestScore) {
      best = { start: from, end };
      bestScore = score;
    }
    from = text.indexOf(quote, from + 1);
  }
  return best;
}

/** True when two spans share at least one character. */
export function spansOverlap(a: TextSpan, b: TextSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/** A random id for a new highlight. */
export function newHighlightId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}
