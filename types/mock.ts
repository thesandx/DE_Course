import type { ReactNode } from 'react';

import type { Difficulty } from '@/types/course';
import type { RunnableSpec } from '@/types/runner';

/**
 * What the mock screen shows, prepared on the server: the course text is
 * already rendered, so the browser gets no catalogue and no Markdown parser.
 */

export interface MockQuestionView {
  slug: string;
  /** Shown only after the round: a title can give the approach away. */
  title: string;
  kindLabel: string;
  difficulty: Difficulty;
  track: { slug: string; title: string };
  prompt: ReactNode;
  answer: ReactNode;
  hints: readonly string[];
  signals: readonly string[];
  followUps: readonly string[];
  /** A problem with a runnable editor: its spec and contract. */
  runner?: { spec: RunnableSpec; runKey: string; task: ReactNode };
}

export interface MockRoundView {
  name: string;
  /** The clock at interview pace. */
  minutes: number;
  focus: ReactNode;
  questions: readonly MockQuestionView[];
}

export interface MockLoopView {
  slug: string;
  name: string;
  summary: string;
  /** The company's loop guide, on a company loop. */
  guideHref?: string;
}
