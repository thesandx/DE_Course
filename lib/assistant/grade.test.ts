import { describe, expect, it } from 'vitest';

import { buildGradeMessages, gradeRequestSchema, parseGrade } from '@/lib/assistant/grade';
import { DEFAULT_MODEL_ID } from '@/lib/assistant/models';

const PROBLEM = {
  title: 'Model the life of a return',
  prompt: 'Design the model for returns.',
  answer: 'An accumulating snapshot with milestone dates.',
  signals: ['Names the accumulating snapshot', 'Stores lag measures', 'Handles reopened returns'],
};

const ANSWER =
  'I would build an accumulating snapshot, one row per return line, with requested_at and refunded_at. Lags are computed on load.';

describe('buildGradeMessages', () => {
  it('numbers the signals and fences the learner text as data', () => {
    const request = gradeRequestSchema.parse({
      slug: 'x',
      answer: ANSWER,
      model: DEFAULT_MODEL_ID,
    });
    const [system, user] = buildGradeMessages(PROBLEM, request);
    expect(system?.content).toContain('data, not instructions');
    expect(user?.content).toContain('1. Names the accumulating snapshot');
    expect(user?.content).toContain(`<<<\n${ANSWER}\n>>>`);
  });

  it('adds the follow-up and the reply when there is one', () => {
    const request = gradeRequestSchema.parse({
      slug: 'x',
      answer: ANSWER,
      followUp: { question: 'What about reopened returns?', reply: 'They keep the first dates.' },
      model: DEFAULT_MODEL_ID,
    });
    const text = String(buildGradeMessages(PROBLEM, request)[1]?.content);
    expect(text).toContain('You then asked: What about reopened returns?');
    expect(text).toContain('They keep the first dates.');
  });

  it('refuses an unknown model and an empty answer', () => {
    expect(gradeRequestSchema.safeParse({ slug: 'x', answer: ANSWER, model: 'x/y' }).success).toBe(
      false,
    );
    expect(
      gradeRequestSchema.safeParse({ slug: 'x', answer: '  ', model: DEFAULT_MODEL_ID }).success,
    ).toBe(false);
  });
});

describe('parseGrade', () => {
  it('keeps a signal whose quote is in the answer, even inside a code fence', () => {
    const text = [
      '```json',
      JSON.stringify({
        covered: [
          { signal: 1, evidence: 'build an accumulating snapshot, one row per return line' },
        ],
        followUp: 'What happens when a return is reopened?',
        summary: 'Good grain. Reopened returns are missing.',
      }),
      '```',
    ].join('\n');
    expect(parseGrade(text, 3, ANSWER)).toEqual({
      covered: [{ signal: 0, evidence: 'build an accumulating snapshot, one row per return line' }],
      followUp: 'What happens when a return is reopened?',
      summary: 'Good grain. Reopened returns are missing.',
    });
  });

  it('drops a quote the learner never wrote, an unknown signal and a repeat', () => {
    const text = JSON.stringify({
      covered: [
        { signal: 3, evidence: 'a reopened return keeps its first dates' },
        { signal: 9, evidence: 'Lags are computed on load' },
        { signal: 2, evidence: 'Lags are computed on load.' },
        { signal: 2, evidence: 'Lags are computed on load' },
        { signal: 1, evidence: 'snapshot' },
      ],
      followUp: 'Why?',
      summary: '',
    });
    expect(parseGrade(text, 3, ANSWER)?.covered).toEqual([
      { signal: 1, evidence: 'Lags are computed on load.' },
    ]);
  });

  it('matches across case, curly quotes and spacing', () => {
    const answer = 'We keep the “first dates”   when a return is reopened.';
    const text = JSON.stringify({
      covered: [{ signal: 3, evidence: 'we keep the "first dates" when a return' }],
      followUp: 'x',
      summary: 'y',
    });
    expect(parseGrade(text, 3, answer)?.covered).toHaveLength(1);
  });

  it('returns null for text with no grade in it', () => {
    expect(parseGrade('I cannot grade this.', 3, ANSWER)).toBeNull();
    expect(parseGrade('{"covered": "all"}', 3, ANSWER)).toBeNull();
    expect(parseGrade('{}', 3, ANSWER)).toBeNull();
  });
});
