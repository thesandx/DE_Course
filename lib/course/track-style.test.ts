import { describe, expect, it } from 'vitest';

import { TRACKS } from '@/lib/course/catalog';

import { trackNumber, trackStyle } from './track-style';

describe('trackStyle', () => {
  it('gives every track its own hue, in study order', () => {
    const fills = TRACKS.map((track) => trackStyle(track.slug).fill);
    expect(new Set(fills).size).toBe(TRACKS.length);
    const first = TRACKS[0];
    expect(first && trackStyle(first.slug)).toMatchObject({
      number: 1,
      fill: 'bg-track-1',
      rail: 'border-l-track-1',
      edge: 'border-t-track-1',
    });
  });

  it('falls back to the first hue for an unknown slug', () => {
    expect(trackStyle('no-such-track').fill).toBe('bg-track-1');
  });
});

describe('trackNumber', () => {
  it('pads to two digits', () => {
    const second = TRACKS[1];
    expect(second && trackNumber(second.slug)).toBe('02');
  });
});
