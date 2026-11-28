import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TextHighlighter } from '@/components/notes/TextHighlighter';

const KEY = 'de:lesson:sql:window-functions';

class FakeHighlight {
  readonly ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

describe('TextHighlighter', () => {
  const registry = new Map<string, FakeHighlight>();

  beforeEach(() => {
    registry.clear();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights: registry });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ highlights: null })))),
    );
    window.localStorage.setItem(
      `loop-ready-note:highlights:${KEY}`,
      JSON.stringify({
        items: [
          {
            id: 'a1b2c3d4e5f6a7b8',
            scope: 'body',
            text: 'ROW_NUMBER',
            prefix: 'Use ',
            suffix: ' once',
            color: 'neon',
            at: '2026-11-27T10:00:00.000Z',
          },
        ],
        editedAt: '2026-11-27T10:00:00.000Z',
        synced: true,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('paints a saved highlight over its text, and shows the text unchanged', async () => {
    render(
      <TextHighlighter noteKey={KEY} scope="body">
        <p>
          Use <b>ROW_NUMBER</b> once.
        </p>
      </TextHighlighter>,
    );
    expect(screen.getByText('ROW_NUMBER')).toBeInTheDocument();
    await waitFor(() => expect(registry.get('text-hl-neon')?.ranges).toHaveLength(1));
    expect(registry.get('text-hl-neon')?.ranges[0]?.toString()).toBe('ROW_NUMBER');
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('paints nothing for a highlight in another section', () => {
    render(
      <TextHighlighter noteKey={KEY} scope="answer">
        <p>Use ROW_NUMBER once.</p>
      </TextHighlighter>,
    );
    // The list is already loaded for this chapter, so the section paints at once.
    expect(screen.getByText('Use ROW_NUMBER once.')).toBeInTheDocument();
    expect(registry.has('text-hl-neon')).toBe(false);
  });
});
