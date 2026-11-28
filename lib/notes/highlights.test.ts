import { describe, expect, it } from 'vitest';

import {
  anchorFor,
  CONTEXT_CHARS,
  locateHighlight,
  newHighlightId,
  spansOverlap,
  trimSpan,
} from '@/lib/notes/highlights';

const TEXT = 'A shuffle moves data. Spark avoids a shuffle when it can, because a shuffle is slow.';

describe('trimSpan', () => {
  it('drops white space at both ends', () => {
    expect(trimSpan('  key term  ', 0, 12)).toEqual({ start: 2, end: 10 });
  });

  it('gives null for a span of only white space', () => {
    expect(trimSpan('a   b', 1, 4)).toBeNull();
  });

  it('accepts the ends in either order', () => {
    expect(trimSpan('abc', 3, 0)).toEqual({ start: 0, end: 3 });
  });
});

describe('locateHighlight', () => {
  it('finds the same copy of a repeated quote by its context', () => {
    const second = TEXT.indexOf('shuffle', 10);
    const anchor = anchorFor(TEXT, { start: second, end: second + 7 });
    expect(anchor.text).toBe('shuffle');
    expect(anchor.prefix.length).toBeLessThanOrEqual(CONTEXT_CHARS);
    expect(locateHighlight(TEXT, anchor)).toEqual({ start: second, end: second + 7 });
  });

  it('still finds a quote when the text around it changed', () => {
    const anchor = anchorFor(TEXT, { start: 22, end: 27 });
    expect(anchor.text).toBe('Spark');
    const edited = `Intro. ${TEXT}`;
    expect(locateHighlight(edited, anchor)).toEqual({ start: 29, end: 34 });
  });

  it('gives null when the quote is gone', () => {
    expect(locateHighlight(TEXT, { text: 'Kafka', prefix: '', suffix: '' })).toBeNull();
    expect(locateHighlight(TEXT, { text: '', prefix: '', suffix: '' })).toBeNull();
  });
});

describe('spansOverlap and newHighlightId', () => {
  it('sees a shared character, not a shared edge', () => {
    expect(spansOverlap({ start: 0, end: 5 }, { start: 4, end: 9 })).toBe(true);
    expect(spansOverlap({ start: 0, end: 5 }, { start: 5, end: 9 })).toBe(false);
  });

  it('makes a 16-character id', () => {
    expect(newHighlightId()).toMatch(/^[a-f0-9]{16}$/);
  });
});
