import { DSA_ANSWERS } from '@/lib/course/runnables/dsa-answers';
import { ORCHESTRATION_ANSWERS } from '@/lib/course/runnables/orchestration-answers';
import { PYTHON_ANSWERS } from '@/lib/course/runnables/python-answers';
import { SPARK_ANSWERS } from '@/lib/course/runnables/spark-answers';
import { SQL_ANSWERS } from '@/lib/course/runnables/sql-answers';
import { WAREHOUSE_SQL_ANSWERS } from '@/lib/course/runnables/warehouse-sql-answers';

/**
 * Other answers for the runnable problems, for the tests only. `pass` holds
 * correct answers that differ from the reference solution: the grader must
 * accept them. `fail` holds the usual mistakes: the hidden tests must catch
 * them. Together they show that the tests judge the contract, not one way
 * of writing it.
 */
export interface SpecAnswers {
  pass?: readonly string[];
  fail?: readonly string[];
}

export const TEST_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  ...SQL_ANSWERS,
  ...WAREHOUSE_SQL_ANSWERS,
  ...DSA_ANSWERS,
  ...SPARK_ANSWERS,
  ...PYTHON_ANSWERS,
  ...ORCHESTRATION_ANSWERS,
};
