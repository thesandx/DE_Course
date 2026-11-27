import { DSA_RUNNABLES } from '@/lib/course/runnables/dsa';
import { SPARK_RUNNABLES } from '@/lib/course/runnables/spark';
import { SQL_RUNNABLES } from '@/lib/course/runnables/sql';
import type { RunnableSpec } from '@/types/runner';

/**
 * Every runnable spec, by problem slug. A problem with a spec gets the
 * runnable editor; the others keep the written draft.
 */
export const RUNNABLES: Readonly<Record<string, RunnableSpec>> = {
  ...SQL_RUNNABLES,
  ...DSA_RUNNABLES,
  ...SPARK_RUNNABLES,
};

export function getRunnable(slug: string): RunnableSpec | undefined {
  return Object.hasOwn(RUNNABLES, slug) ? RUNNABLES[slug] : undefined;
}
