import { describe, expect, it } from 'vitest';

import { MAX_STORIES, storyInputSchema } from '@/lib/course/story-bank';
import {
  assessStory,
  speakingTime,
  STORY_THEME_SLUGS,
  STORY_THEMES,
  type StoryText,
  storyWordCount,
} from '@/lib/course/story-bank-themes';

const words = (count: number, word = 'pipeline'): string => Array(count).fill(word).join(' ');

const STRONG: StoryText = {
  situation: `Four product teams computed daily active riders four ways. ${words(30)}`,
  task: `Nobody owned the definition, and I was a senior engineer on one team. ${words(30)}`,
  action: `I measured the gap, I met each lead, and I chose one certified metric instead of four. I wrote the proposal and found a director to sponsor it. ${words(80)}`,
  result: `All 4 teams moved in two quarters and saved $20,000 a month. ${words(30)}`,
  reflection: 'I would involve finance earlier, because they owned the board numbers.',
};

describe('story themes', () => {
  it('has one theme per slug, with a question and a staff signal', () => {
    expect(STORY_THEMES.map((theme) => theme.slug)).toEqual([...STORY_THEME_SLUGS]);
    for (const theme of STORY_THEMES) {
      expect(theme.question.length).toBeGreaterThan(10);
      expect(theme.staffSignal.length).toBeGreaterThan(10);
    }
  });
});

describe('assessStory', () => {
  it('passes every check for a strong story', () => {
    const failed = assessStory(STRONG).filter((check) => !check.ok);
    expect(failed).toEqual([]);
  });

  it('flags a thin "we" story with no number, trade-off, scope or lesson', () => {
    const weak: StoryText = {
      situation: 'The pipeline was slow.',
      task: 'Make it faster.',
      action: 'We tuned it and we shipped it.',
      result: 'It was faster.',
      reflection: '',
    };
    const failed = assessStory(weak)
      .filter((check) => !check.ok)
      .map((check) => check.id);
    expect(failed).toEqual(['length', 'numbers', 'ownership', 'trade-off', 'scope', 'reflection']);
  });

  it('flags a story that is too long to tell in three minutes', () => {
    const long = { ...STRONG, situation: words(500) };
    const length = assessStory(long).find((check) => check.id === 'length');
    expect(length?.ok).toBe(false);
    expect(length?.tip).toMatch(/Too long/);
  });
});

describe('word count and speaking time', () => {
  it('counts the words of every STAR field', () => {
    expect(
      storyWordCount({ situation: 'a b', task: 'c', action: '', result: 'd e f', reflection: 'g' }),
    ).toBe(7);
  });

  it('formats minutes and seconds at 150 words a minute', () => {
    expect(speakingTime(0)).toBe('0:00');
    expect(speakingTime(300)).toBe('2:00');
    expect(speakingTime(225)).toBe('1:30');
  });
});

describe('storyInputSchema', () => {
  const VALID = { title: 'One metric', themes: ['influence'], ...STRONG };

  it('accepts a new story without an id', () => {
    expect(storyInputSchema.safeParse(VALID).success).toBe(true);
  });

  it('refuses unknown themes, repeated themes, too many themes and unknown fields', () => {
    for (const body of [
      { ...VALID, themes: ['bravery'] },
      { ...VALID, themes: ['conflict', 'conflict'] },
      { ...VALID, themes: ['conflict', 'failure', 'influence', 'ambiguity', 'trade-off'] },
      { ...VALID, themes: [] },
      { ...VALID, ownerId: 'someone-else' },
      { ...VALID, title: '   ' },
      { ...VALID, id: 'not-a-uuid' },
    ]) {
      expect(storyInputSchema.safeParse(body).success).toBe(false);
    }
  });

  it('keeps the bank small enough for one document', () => {
    expect(MAX_STORIES).toBeLessThanOrEqual(12);
  });
});
