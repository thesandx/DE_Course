import type { MockSlot } from '@/types/course';

/**
 * The questions a timed mock round can ask. A company round lists the slots
 * it asks, so its mock asks what the real round asks: two SQL questions and a
 * story for an Amazon SQL round, one design question for a design round.
 *
 * A slot without `tracks` draws from the round's own tracks. That keeps a
 * design round company-flavoured: Uber's draws from streaming and AI design,
 * Microsoft's from lakehouse and Azure design.
 *
 * Data only, with no catalogue import, so the company files can use it.
 */
export const MOCK = {
  /** A SQL problem from the round's tracks. Every one runs in the editor. */
  sql: { label: 'SQL', kinds: ['sql'] },
  python: { label: 'Python', kinds: ['coding'], tracks: ['python'] },
  dsa: { label: 'Algorithms', kinds: ['coding'], tracks: ['dsa'] },
  /** Python or algorithms, whichever the draw gives: a general coding round. */
  coding: { label: 'Coding', kinds: ['coding'], tracks: ['python', 'dsa'] },
  spark: { label: 'PySpark', kinds: ['coding'], tracks: ['spark'] },
  /** Pipeline code: Airflow and Prefect tasks, extractors, pandas. */
  pipeline: { label: 'Pipeline code', kinds: ['coding'], tracks: ['orchestration', 'python'] },
  modeling: { label: 'Data modeling', kinds: ['modeling'], tracks: ['modeling', 'cloud'] },
  /** A short SQL problem for a speed screen: easy or medium, about six minutes. */
  quickSql: { label: 'SQL', kinds: ['sql'], tracks: ['sql'], difficulties: ['easy', 'medium'] },
  /** A short Python problem for a speed screen: easy or medium, about six minutes. */
  quickPython: {
    label: 'Python',
    kinds: ['coding'],
    tracks: ['python'],
    difficulties: ['easy', 'medium'],
  },
  /** A design question from the round's tracks. */
  design: { label: 'System design', kinds: ['design'] },
  /** "How does it work underneath": a concept question from the round's tracks. */
  deepDive: { label: 'Deep dive', kinds: ['concept'] },
  behavioral: { label: 'Behavioral', kinds: ['behavioral'], tracks: ['behavioral'] },
  /** A story at staff scope: influence, strategy, raising the bar. */
  leadership: { label: 'Leadership', kinds: ['behavioral'], tracks: ['behavioral', 'staff'] },
  /** A staff design or strategy question: platforms, migrations, build or buy. */
  architecture: {
    label: 'Architecture',
    kinds: ['design', 'concept'],
    tracks: ['staff', 'architecture'],
  },
} as const satisfies Record<string, MockSlot>;
