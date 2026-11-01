/**
 * The GCP course's shape. The course prepares for the Google Cloud
 * Professional Data Engineer exam and is laid out as a metro map: each exam
 * domain is a coloured line, and each exam section is a station on it.
 *
 * The content lives in `lib/course/gcp/`. Prose fields use the course
 * Markdown dialect (`lib/course/markdown.ts`); short fields such as a prompt
 * or an option use its inline markers only.
 */

/** A question with one or more correct options. `answers` holds option indexes. */
export interface ChoiceQuestion {
  prompt: string;
  options: readonly string[];
  /** Indexes into `options`. More than one means "choose N". */
  answers: readonly number[];
  /** Why the answer is right. Shown after the learner answers. */
  why: string;
}

/** A station check: pick an option, match pairs, or put steps in order. */
export type StationCheck =
  | ({ type: 'choice' } & ChoiceQuestion)
  | {
      type: 'match';
      prompt: string;
      /** Left side, right side. The learner sees the right side shuffled. */
      pairs: ReadonlyArray<readonly [string, string]>;
      why: string;
    }
  | {
      type: 'order';
      prompt: string;
      /** The steps in the correct order. The learner sees them shuffled. */
      steps: readonly string[];
      why: string;
    };

/** One concept on a station: a short reference read. */
export interface GcpConcept {
  title: string;
  /** Course Markdown dialect. */
  body: string;
}

/** A key point the learner must prove with a check before the station counts. */
export interface KeyPoint {
  /** The one sentence to remember. */
  point: string;
  /** Optional extra detail, in the course Markdown dialect. */
  more?: string;
  check: StationCheck;
}

export interface GcpStation {
  slug: string;
  /** The exam guide's section number, such as "1.1". */
  code: string;
  title: string;
  /** The scenario that frames the station. */
  mission: string;
  concepts: readonly GcpConcept[];
  keyPoints: readonly KeyPoint[];
}

export interface GcpLine {
  slug: string;
  /** 1-based; the exam domain number. */
  number: number;
  title: string;
  /** A short name for chips and the map legend. */
  short: string;
  /** The domain's share of the exam, in percent. */
  weight: number;
  /** Which `--color-track-*` hue the line uses. */
  hue: number;
  intro: string;
  boss: { title: string; story: string };
  stations: readonly GcpStation[];
}

/** A question in the shared bank, used by boss rounds and the mock exam. */
export interface BankQuestion extends ChoiceQuestion {
  /** The station slug the question tests. */
  station: string;
}

export interface Flashcard {
  /** Line slug. */
  line: string;
  front: string;
  back: string;
}

export interface SprintRound {
  scenario: string;
  answer: string;
  distractors: readonly string[];
}
