/**
 * How a timed mock is scored, and the verdict a debrief would give. Pure and
 * free of the catalogue, so the mock screen can import it without the whole
 * course in its bundle.
 *
 * A problem with a runnable editor scores mostly on its tests (70%) and the
 * rest on the senior signals the learner ticks: a passing query that nobody
 * explained is not a strong round. Any other problem scores on its signals:
 * the ones Pip credited with a quote from the answer, or else the ones the
 * learner ticked (ADR-0019).
 * Each hint costs a tenth of the problem's score, to at most half.
 */

export interface ProblemFacts {
  /** How many senior signals the problem lists. */
  signals: number;
  /** True when the problem has a runnable editor with tests. */
  runnable: boolean;
}

export interface ProblemResult {
  hints: number;
  /** The best Submit of the round, or null when the learner never submitted. */
  tests: { passed: number; total: number } | null;
  /** The indexes of the signals the learner ticked. */
  covered: readonly number[];
}

export const TEST_WEIGHT = 0.7;
export const HINT_COST = 0.1;
export const HINT_FLOOR = 0.5;

/** The share of the problem done, from 0 to 1. */
export function problemScore(facts: ProblemFacts, result: ProblemResult): number {
  const ticked = new Set(result.covered.filter((index) => index >= 0 && index < facts.signals));
  const signalShare = facts.signals === 0 ? 0 : ticked.size / facts.signals;
  const testShare =
    result.tests === null || result.tests.total === 0
      ? 0
      : Math.min(result.tests.passed / result.tests.total, 1);
  const base = facts.runnable
    ? TEST_WEIGHT * testShare + (1 - TEST_WEIGHT) * signalShare
    : signalShare;
  return base * Math.max(HINT_FLOOR, 1 - HINT_COST * result.hints);
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Each round's score: the average of its questions' scores. */
export function scoreRounds(
  facts: readonly (readonly ProblemFacts[])[],
  results: readonly (readonly ProblemResult[])[],
): number[] {
  return facts.map((questions, round) =>
    average(
      questions.map((question, index) => {
        const result = results[round]?.[index];
        return result === undefined ? 0 : problemScore(question, result);
      }),
    ),
  );
}

export type VerdictLabel = 'Strong hire' | 'Hire' | 'Lean hire' | 'Lean no hire' | 'No hire';

export interface Verdict {
  label: VerdictLabel;
  /** `easy` reads as a pass, `medium` as borderline, `hard` as a fail. */
  tone: 'easy' | 'medium' | 'hard';
  /** One sentence for the debrief. */
  reason: string;
}

/** Below this, one round is a red flag that caps the verdict, as in a real debrief. */
export const RED_FLAG = 0.3;

const BANDS: readonly (Verdict & { min: number })[] = [
  {
    min: 0.85,
    label: 'Strong hire',
    tone: 'easy',
    reason: 'Every round cleared the bar with room to spare.',
  },
  {
    min: 0.7,
    label: 'Hire',
    tone: 'easy',
    reason: 'A clear pass: strong in most rounds, and nothing alarming.',
  },
  {
    min: 0.55,
    label: 'Lean hire',
    tone: 'medium',
    reason: 'A pass on a good day. One more strong round would make it clear.',
  },
  {
    min: 0.4,
    label: 'Lean no hire',
    tone: 'hard',
    reason: 'Close, but the rounds below the bar outweigh the strong ones.',
  },
  {
    min: 0,
    label: 'No hire',
    tone: 'hard',
    reason: 'Most rounds fell short. Study the weak areas below, then run the loop again.',
  },
];

/** The debrief's verdict for the round scores of a finished loop. */
export function verdictFor(roundScores: readonly number[]): Verdict {
  const overall = average(roundScores);
  const band = BANDS.find((item) => overall >= item.min) ?? BANDS[BANDS.length - 1];
  const { label, tone, reason } = band as Verdict;
  const redFlag = roundScores.some((score) => score < RED_FLAG);
  if (redFlag && (label === 'Strong hire' || label === 'Hire' || label === 'Lean hire')) {
    return {
      label: 'Lean no hire',
      tone: 'hard',
      reason:
        'Strong elsewhere, but one round fell far below the bar, and one such round can sink a loop.',
    };
  }
  return { label, tone, reason };
}

/** The tone of a verdict from its label alone, as the history stores it. */
export function toneOf(label: string): Verdict['tone'] {
  if (label === 'Strong hire' || label === 'Hire') return 'easy';
  return label === 'Lean hire' ? 'medium' : 'hard';
}

/** "45 min", "1 h", "4 h 45 min". */
export function formatMinutes(minutes: number): string {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A countdown: "44:59", or "1:04:59" from an hour up. Never below zero. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** "42%". */
export function percent(ratio: number): string {
  return `${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%`;
}
