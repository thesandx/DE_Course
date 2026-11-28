import { getProblem } from '@/lib/course/catalog';
import { parseMarkdown } from '@/lib/course/markdown';

/** The fences the Python and PySpark editors run. */
export const PYTHON_FENCES: readonly string[] = ['python', 'pyspark'];

/**
 * The fence the SQL editor runs. `sql` is PostgreSQL. A warehouse dialect has
 * its own fence (`bigquery`, `snowflake`, `dbt`) and is shown, not run.
 */
export const SQL_FENCES: readonly string[] = ['sql'];

/**
 * The code blocks of a problem's written model answer, in the given fences,
 * in order. The spec tests run them against the problem's tests, so the
 * answer a learner reads also passes the editor.
 */
export function writtenAnswerBlocks(slug: string, fences: readonly string[]): string[] {
  const answer = getProblem(slug)?.answer ?? '';
  return parseMarkdown(answer).flatMap((block) =>
    block.kind === 'code' && fences.includes(block.lang) ? [block.code] : [],
  );
}
