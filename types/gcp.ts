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

/**
 * A file the learner needs for a lab. The lab page offers it as a download
 * and as a Cloud Shell command that writes it, so a lab needs nothing else.
 */
export interface LabFile {
  /** The file name, such as "employees.csv". Letters, digits, dots, dashes and underscores. */
  name: string;
  /** One line on what the file holds. */
  about: string;
  content: string;
}

/** One step of a lab: what to do in the console, in SQL, or in Cloud Shell, and what to check. */
export interface LabStep {
  title: string;
  /** Why the step matters and what to look for. Course Markdown dialect. */
  body: string;
  /** The 1-based numbers of the station's concepts that the step practises. */
  concepts: readonly number[];
  /** Clicks in the Google Cloud console, as a numbered list in the dialect. */
  console?: string;
  /** SQL to run in the BigQuery Studio editor. Plain text. */
  sql?: string;
  /** Commands to run in Cloud Shell. Plain text. */
  shell?: string;
  /** What the learner sees when the step worked. Course Markdown dialect. */
  check?: string;
  /**
   * Where in the Google Cloud console the learner sees the result of the
   * step: the page, the tab and what it shows. Course Markdown dialect.
   */
  see?: string;
}

/**
 * A hands-on lab for one station. The learner opens it after the station,
 * does every step in their own Google Cloud project, then deletes everything
 * the lab created. The lab counts only once every cleanup step is ticked.
 */
export interface GcpLab {
  /** The station slug. A lab belongs to exactly one station. */
  station: string;
  title: string;
  /** The situation the lab puts the learner in. */
  scenario: string;
  minutes: number;
  /** The APIs the setup step enables, such as "bigquery.googleapis.com". */
  apis: readonly string[];
  /** Extra Cloud Shell variables the setup step exports, name to value. */
  vars?: Readonly<Record<string, string>>;
  /** Every resource the lab creates. The cleanup deletes each one. */
  creates: readonly string[];
  /** What the lab costs if the learner follows the cleanup. Course Markdown dialect. */
  cost: string;
  /** How to stay inside the free tier. Inline markers only. */
  freeTier: readonly string[];
  files: readonly LabFile[];
  steps: readonly LabStep[];
  /** The cleanup steps. Mandatory: the lab cannot be finished without them. */
  cleanup: readonly LabStep[];
  /** Cloud Shell commands that prove nothing the lab made is left. */
  verify: string;
  /** The console pages that prove nothing the lab made is left, as a numbered list. */
  verifyConsole: string;
}
