/**
 * The themes of the behavioral story bank, and a pure check of a story's
 * strength. No zod here, so the editor can import it statically.
 */

export const STORY_THEME_SLUGS = [
  'conflict',
  'failure',
  'influence',
  'ambiguity',
  'trade-off',
  'biggest-project',
  'multiplying',
  'disagree-commit',
  'customer-impact',
  'data-decision',
] as const;

export type StoryThemeSlug = (typeof STORY_THEME_SLUGS)[number];

export interface StoryTheme {
  slug: StoryThemeSlug;
  /** A short label for chips and the coverage grid. */
  label: string;
  /** How an interviewer asks for it. */
  question: string;
  /** What a staff-level telling of this story shows. */
  staffSignal: string;
}

export const STORY_THEMES: readonly StoryTheme[] = [
  {
    slug: 'conflict',
    label: 'Conflict',
    question: 'Tell me about a conflict with another team.',
    staffSignal: 'You found the need under each position, and the relationship survived.',
  },
  {
    slug: 'failure',
    label: 'Failure',
    question: 'Tell me about your biggest mistake.',
    staffSignal: 'You own it without excuses, and you changed a system so it cannot recur.',
  },
  {
    slug: 'influence',
    label: 'Influence',
    question: 'Tell me about convincing people you had no authority over.',
    staffSignal:
      'You quantified the problem, wrote it down, found a sponsor and lowered the cost of yes.',
  },
  {
    slug: 'ambiguity',
    label: 'Ambiguity',
    question: 'Tell me about delivering when the goal was unclear.',
    staffSignal: 'You decided what the problem was, and what you would not solve.',
  },
  {
    slug: 'trade-off',
    label: 'Trade-off',
    question: 'Tell me about trading quality against a deadline.',
    staffSignal: 'You named what you gave up, why, and how you paid the debt back.',
  },
  {
    slug: 'biggest-project',
    label: 'Biggest project',
    question: 'Walk me through the project you are proudest of.',
    staffSignal: 'Scope beyond your team, your own decisions, and a business result in numbers.',
  },
  {
    slug: 'multiplying',
    label: 'Multiplying others',
    question: 'Tell me about making other engineers more effective.',
    staffSignal: 'You built something that worked without you: a template, a guide, a habit.',
  },
  {
    slug: 'disagree-commit',
    label: 'Disagree and commit',
    question: 'Tell me about a decision you disagreed with.',
    staffSignal: 'You argued with data, committed fully, and set a checkpoint to revisit.',
  },
  {
    slug: 'customer-impact',
    label: 'Customer impact',
    question: 'Tell me about a time you put users or customers first.',
    staffSignal: 'You started from the user’s problem and measured the change for them.',
  },
  {
    slug: 'data-decision',
    label: 'Data-driven call',
    question: 'Tell me about a decision you made with incomplete data.',
    staffSignal: 'You made the call, said what would change your mind, and checked later.',
  },
];

/** The number of themes a ready bank covers. */
export const THEMES_TARGET = 8;

/** The STAR fields, in speaking order, with a prompt that guides the writing. */
export const STORY_FIELDS = [
  {
    name: 'situation',
    label: 'Situation',
    hint: 'Two sentences. The context and the stakes, with one number: users, money, teams or hours.',
  },
  {
    name: 'task',
    label: 'Task',
    hint: 'What you owned, and why it was hard. Say if nobody had asked you to do it.',
  },
  {
    name: 'action',
    label: 'Action',
    hint: 'Three to five steps you took, with "I". Include the option you rejected and why.',
  },
  {
    name: 'result',
    label: 'Result',
    hint: 'The outcome in numbers, and what changed for other teams because of you.',
  },
  {
    name: 'reflection',
    label: 'What you learned',
    hint: 'One thing you would do differently, or a habit you kept. Interviewers often ask.',
  },
] as const;

export type StoryFieldName = (typeof STORY_FIELDS)[number]['name'];

export type StoryText = Record<StoryFieldName, string>;

/** Spoken English runs about 150 words a minute. A strong answer takes about 1.5 to 3 minutes. */
export const WORDS_PER_MINUTE = 150;
const MIN_WORDS = 220;
const MAX_WORDS = 480;

export interface StoryCheck {
  id: 'length' | 'numbers' | 'ownership' | 'trade-off' | 'scope' | 'reflection';
  label: string;
  ok: boolean;
  /** What to change when the check fails. */
  tip: string;
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9’']+/g) ?? [];
}

/** Total words across the STAR fields. */
export function storyWordCount(story: StoryText): number {
  return STORY_FIELDS.reduce((total, field) => total + words(story[field.name]).length, 0);
}

/** Whole minutes and seconds to say the story out loud, as "2:10". */
export function speakingTime(wordCount: number): string {
  const seconds = Math.round((wordCount / WORDS_PER_MINUTE) * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const TRADE_OFF_WORDS = [
  'instead',
  'rejected',
  'trade-off',
  'tradeoff',
  'gave',
  'cost',
  'chose',
  'option',
  'rather',
];
const SCOPE_WORDS = [
  'teams',
  'org',
  'organization',
  'organisation',
  'director',
  'vp',
  'company',
  'leadership',
  'cross-team',
];

/**
 * Checks a story against the habits that raise a behavioral answer to senior
 * or staff level. Heuristics, not grading: each failed check comes with a tip.
 */
export function assessStory(story: StoryText): StoryCheck[] {
  const count = storyWordCount(story);
  const action = words(story.action);
  const iCount = action.filter((word) => word === 'i' || word === 'i’m' || word === "i'm").length;
  const weCount = action.filter((word) => word === 'we' || word === 'our' || word === 'us').length;
  const all = STORY_FIELDS.flatMap((field) => words(story[field.name]));

  return [
    {
      id: 'length',
      label: 'About 1.5 to 3 minutes out loud',
      ok: count >= MIN_WORDS && count <= MAX_WORDS,
      tip:
        count < MIN_WORDS
          ? 'Too thin to probe. Add the steps you took and the result.'
          : 'Too long to hold attention. Cut the situation to two sentences.',
    },
    {
      id: 'numbers',
      label: 'The result has a number',
      ok: /\d/.test(story.result),
      tip: 'Put a number in the result: hours saved, cost, freshness, incidents, teams.',
    },
    {
      id: 'ownership',
      label: 'The action says "I", not only "we"',
      ok: iCount > 0 && iCount >= weCount,
      tip: 'Say what you decided and did. "We" hides your part from the interviewer.',
    },
    {
      id: 'trade-off',
      label: 'It names a trade-off or a rejected option',
      ok: TRADE_OFF_WORDS.some((word) => all.includes(word)),
      tip: 'Name the option you did not take, or what your choice cost.',
    },
    {
      id: 'scope',
      label: 'It shows scope beyond your team',
      ok: SCOPE_WORDS.some((word) => all.includes(word)),
      tip: 'Show who else changed because of you: other teams, a director, the company.',
    },
    {
      id: 'reflection',
      label: 'It ends with what you learned',
      ok: words(story.reflection).length >= 8,
      tip: 'Add one thing you would do differently. Interviewers often ask for it.',
    },
  ];
}
