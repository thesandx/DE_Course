import { DSA_RUNNABLES } from '@/lib/course/runnables/dsa';
import { MODELING_SQL_RUNNABLES } from '@/lib/course/runnables/modeling-sql';
import { ORCHESTRATION_RUNNABLES } from '@/lib/course/runnables/orchestration';
import { PYTHON_RUNNABLES } from '@/lib/course/runnables/python';
import { SPARK_RUNNABLES } from '@/lib/course/runnables/spark';
import { SQL_RUNNABLES } from '@/lib/course/runnables/sql';
import { SQL_HARD_RUNNABLES } from '@/lib/course/runnables/sql-hard';
import { WAREHOUSE_SQL_RUNNABLES } from '@/lib/course/runnables/warehouse-sql';
import type { RunnableSpec } from '@/types/runner';

/**
 * Every runnable spec, by problem slug. A problem with a spec gets the
 * runnable editor; the others keep the written draft.
 */
export const RUNNABLES: Readonly<Record<string, RunnableSpec>> = {
  ...SQL_RUNNABLES,
  ...SQL_HARD_RUNNABLES,
  ...WAREHOUSE_SQL_RUNNABLES,
  ...MODELING_SQL_RUNNABLES,
  ...DSA_RUNNABLES,
  ...SPARK_RUNNABLES,
  ...PYTHON_RUNNABLES,
  ...ORCHESTRATION_RUNNABLES,
};

export function getRunnable(slug: string): RunnableSpec | undefined {
  return Object.hasOwn(RUNNABLES, slug) ? RUNNABLES[slug] : undefined;
}
