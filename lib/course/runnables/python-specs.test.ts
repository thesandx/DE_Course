// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RUNNABLES } from '@/lib/course/runnables';
import { TEST_ANSWERS } from '@/lib/course/runnables/test-answers';
import { pythonJob } from '@/lib/runner/data';
import type { CaseResult, RunnableSpec } from '@/types/runner';

/**
 * Runs every Python and PySpark spec through the same `harness.py` and
 * `pyspark_shim.py` the browser runs, on the local CPython: the reference
 * solution passes, the starter does not, other correct answers pass and the
 * usual mistakes fail.
 *
 * It needs `python3` with duckdb and pandas (`pip install duckdb==1.5.1
 * pandas==3.0.2`, the versions Pyodide ships). Without them it skips; CI
 * installs them, so the check always runs there.
 */

const PYTHON_DIR = fileURLToPath(new URL('../../../hooks/workers/python/', import.meta.url));

const DRIVER = `
import json, sys
sys.path.insert(0, sys.argv[1])
import harness
for name, file in (("prefect", "prefect_sandbox.py"), ("airflow", "airflow_sandbox.py")):
    with open(sys.argv[1] + file, encoding="utf-8") as handle:
        harness.register_module(name, handle.read())
jobs = json.load(sys.stdin)
print(json.dumps([json.loads(harness.run_job(json.dumps(job)))["cases"] for job in jobs]))
`;

function pythonReady(): boolean {
  const probe = spawnSync('python3', ['-c', 'import duckdb, pandas'], { encoding: 'utf8' });
  return probe.status === 0;
}

const PYTHON_SPECS = Object.entries(RUNNABLES).filter(([, spec]) => spec.language !== 'sql');

interface Program {
  slug: string;
  label: string;
  expect: 'pass' | 'fail';
  code: string;
}

function programs(slug: string, spec: RunnableSpec): Program[] {
  const answers = TEST_ANSWERS[slug] ?? {};
  return [
    { slug, label: 'the reference solution', expect: 'pass', code: spec.solution },
    { slug, label: 'the starter code', expect: 'fail', code: spec.starter },
    ...(answers.pass ?? []).map((code, index) => ({
      slug,
      label: `correct answer ${index + 1}`,
      expect: 'pass' as const,
      code,
    })),
    ...(answers.fail ?? []).map((code, index) => ({
      slug,
      label: `wrong answer ${index + 1}`,
      expect: 'fail' as const,
      code,
    })),
  ];
}

/** Runs every program of every spec in one Python process, so start-up is paid once. */
function runAll(): Map<string, readonly CaseResult[]> {
  const all = PYTHON_SPECS.flatMap(([slug, spec]) => programs(slug, spec));
  const jobs = all.map((program) =>
    pythonJob({
      id: 1,
      action: 'check',
      key: `${program.slug}:test`,
      code: program.code,
      spec: RUNNABLES[program.slug] as RunnableSpec,
    }),
  );
  const output = execFileSync('python3', ['-c', DRIVER, PYTHON_DIR], {
    input: JSON.stringify(jobs),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: 600_000,
  });
  const results = JSON.parse(output) as CaseResult[][];
  return new Map(
    all.map((program, index) => [`${program.slug}|${program.label}`, results[index] ?? []]),
  );
}

const ready = pythonReady();
const results = ready ? runAll() : new Map<string, readonly CaseResult[]>();

describe.skipIf(!ready).each(PYTHON_SPECS)('runnable %s problem', (slug, spec) => {
  it.each(programs(slug, spec).map((program) => [program.label, program] as const))(
    '%s',
    (_, program) => {
      const cases = results.get(`${slug}|${program.label}`) ?? [];
      expect(cases).toHaveLength(spec.cases.length);
      const failed = cases
        .filter((result) => !result.passed)
        .map((result) => `${result.name}: ${result.message}`);
      if (program.expect === 'pass') expect(failed).toEqual([]);
      else expect(failed.length).toBeGreaterThan(0);
    },
  );
});
