/**
 * The course catalogue's shape. The content lives in `lib/course/`; pages,
 * components and the progress service all read these types.
 *
 * Prose fields hold the small Markdown dialect that `lib/course/markdown.ts`
 * parses. See `lib/course/README.md` for how to write it.
 */

/** A candy tone. Each track has one, so its cards and badges keep one identity. */
export type TrackTone = 'butter' | 'soda' | 'grape' | 'peach';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** The companies with a loop guide. A problem names the ones that ask it. */
export type Company = 'uber' | 'google';

/** What kind of answer a problem expects. It sets the label and the round it practises. */
export type ProblemKind = 'sql' | 'coding' | 'design' | 'modeling' | 'concept' | 'behavioral';

/** One multiple-choice question at the end of a lesson. */
export interface QuickCheck {
  question: string;
  options: readonly string[];
  /** Index into `options`. */
  answer: number;
  /** Why the answer is right. Shown after any attempt. */
  why: string;
}

export interface Lesson {
  slug: string;
  title: string;
  /** One sentence: what the learner can do after the lesson. */
  summary: string;
  minutes: number;
  /** The lesson body, in the course Markdown dialect. */
  body: string;
  checks: readonly QuickCheck[];
}

export interface Problem {
  slug: string;
  title: string;
  track: string;
  kind: ProblemKind;
  difficulty: Difficulty;
  companies: readonly Company[];
  /** The question as an interviewer asks it, in the course Markdown dialect. */
  prompt: string;
  /** Revealed one at a time, weakest first. */
  hints: readonly string[];
  /** A strong answer, in the course Markdown dialect. */
  answer: string;
  /** What separates a senior answer from a mid-level one. The learner ticks these off. */
  signals: readonly string[];
  followUps: readonly string[];
}

export interface Track {
  slug: string;
  title: string;
  /** One sentence for cards and metadata. */
  summary: string;
  tone: TrackTone;
  /** Why the track matters in a senior loop, in one or two sentences. */
  why: string;
  lessons: readonly Lesson[];
}

/** A round in a company's interview loop. */
export interface LoopRound {
  name: string;
  minutes: number;
  /** What the round tests, in the course Markdown dialect. */
  focus: string;
  /** Track slugs that prepare for the round. */
  tracks: readonly string[];
}

export interface CompanyGuide {
  slug: Company;
  name: string;
  summary: string;
  /** Two or three short topic tags the loop leans on, shown on readiness cards. */
  highlights: readonly string[];
  /** The guide body, in the course Markdown dialect. */
  overview: string;
  rounds: readonly LoopRound[];
  /** How much each track counts toward readiness for this loop. Weights need not sum to 1. */
  weights: Readonly<Record<string, number>>;
}
