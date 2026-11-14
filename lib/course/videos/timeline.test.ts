import { describe, expect, it } from 'vitest';

import { chapterAt, checkReached, cueAt, formatClock } from '@/lib/course/videos/timeline';
import type { VideoCheck } from '@/types/video';

const chapters = [
  { title: 'The mission', start: 0.3 },
  { title: 'IAM', start: 20 },
  { title: 'Recap', start: 60 },
];

const cues = [
  { start: 0.5, end: 4, text: 'Day one.' },
  { start: 4.2, end: 7, text: 'Lock it down.' },
];

const check = (at: number): VideoCheck => ({
  at,
  prompt: 'Which one?',
  options: ['A', 'B'],
  answers: [1],
  why: 'Because.',
});

describe('formatClock', () => {
  it('writes minutes and two-digit seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(600)).toBe('10:00');
  });

  it('never goes below zero', () => {
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('cueAt', () => {
  it('finds the caption that is spoken at a time', () => {
    expect(cueAt(cues, 1)?.text).toBe('Day one.');
    expect(cueAt(cues, 4.2)?.text).toBe('Lock it down.');
  });

  it('gives nothing in a pause and after the last caption', () => {
    expect(cueAt(cues, 4.1)).toBeUndefined();
    expect(cueAt(cues, 30)).toBeUndefined();
  });
});

describe('chapterAt', () => {
  it('gives the chapter that plays at a time', () => {
    expect(chapterAt(chapters, 25)).toBe(1);
    expect(chapterAt(chapters, 60)).toBe(2);
  });

  it('gives the first chapter during the lead-in', () => {
    expect(chapterAt(chapters, 0)).toBe(0);
  });
});

describe('checkReached', () => {
  const checks = [check(19.5), check(59.5)];

  it('fires when playback moves across a check', () => {
    expect(checkReached(checks, 19.3, 19.6, new Set())).toBe(0);
    expect(checkReached(checks, 59.4, 59.7, new Set())).toBe(1);
  });

  it('stays quiet before a check and after it', () => {
    expect(checkReached(checks, 10, 10.3, new Set())).toBe(-1);
    expect(checkReached(checks, 19.6, 19.9, new Set())).toBe(-1);
  });

  it('does not fire a check that is settled', () => {
    expect(checkReached(checks, 19.3, 19.6, new Set([0]))).toBe(-1);
  });

  it('does not fire for a jump along the bar, forward or back', () => {
    expect(checkReached(checks, 5, 70, new Set())).toBe(-1);
    expect(checkReached(checks, 70, 5, new Set())).toBe(-1);
  });
});
