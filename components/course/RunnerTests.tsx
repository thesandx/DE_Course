import { RunnerOutput } from '@/components/course/RunnerOutput';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';
import type { CaseResult, RunCase } from '@/types/runner';

export interface RunnerTestsProps {
  cases: readonly RunCase[];
  /** Results by case index, from the last Submit. Empty before the first one. */
  results: readonly (CaseResult | undefined)[];
  /** True while a Submit runs: cases without a result show as pending. */
  running: boolean;
}

type CaseState = 'passed' | 'failed' | 'pending' | 'not-run';

function stateOf(result: CaseResult | undefined, running: boolean): CaseState {
  if (result !== undefined) return result.passed ? 'passed' : 'failed';
  return running ? 'pending' : 'not-run';
}

const STATE_WORDS: Record<CaseState, string> = {
  passed: 'Passed',
  failed: 'Failed',
  pending: 'Running',
  'not-run': 'Not run yet',
};

function StateIcon({ state }: { state: CaseState }) {
  const ring = {
    passed: 'bg-easy-soft border-easy-bar',
    failed: 'bg-hard-soft border-hard-bar',
    pending: 'bg-sunken border-line-strong animate-breathe',
    'not-run': 'bg-sunken border-line',
  }[state];
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid size-6 shrink-0 place-items-center rounded-full border', ring)}
    >
      {state === 'passed' || state === 'failed' ? (
        <svg
          viewBox="0 0 24 24"
          className={cn('size-3.5', state === 'passed' ? 'stroke-easy' : 'stroke-hard')}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {state === 'passed' ? <path d="M6 12.5l4 4L18 8" /> : <path d="M7 7l10 10M17 7L7 17" />}
        </svg>
      ) : null}
    </span>
  );
}

/**
 * Every test of a problem, as Submit runs them: the sample, the edge cases
 * and the hidden ones. A failed visible case opens to show both outputs. A
 * hidden case says only what went wrong, so its data stays a surprise.
 */
export function RunnerTests({ cases, results, running }: RunnerTestsProps) {
  const passed = results.filter((result) => result?.passed === true).length;
  const ran = results.some((result) => result !== undefined);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {ran || running ? (
        <Progress
          label="Tests passing"
          value={passed}
          max={cases.length}
          valueText={`${passed} of ${cases.length}`}
        />
      ) : (
        <p className="text-small text-ink-soft">
          Submit runs all {cases.length} tests, the hidden ones too. Run checks only the sample.
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {cases.map((runCase, index) => {
          const result = results[index];
          const state = stateOf(result, running);
          const showOutputs =
            result !== undefined && !result.passed && !runCase.hidden && result.got != null;
          return (
            <li
              key={index}
              className={cn(
                'border-line rounded-input flex flex-col gap-2 border p-3',
                state === 'failed' && 'border-hard-bar',
              )}
            >
              <div className="flex items-start gap-3">
                <StateIcon state={state} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span>{runCase.name}</span>
                    {runCase.hidden === true ? <Badge>Hidden</Badge> : null}
                    <span className="sr-only">{STATE_WORDS[state]}</span>
                  </p>
                  {runCase.note !== undefined && runCase.note !== '' ? (
                    <p className="text-small text-ink-soft">{runCase.note}</p>
                  ) : null}
                </div>
                {result !== undefined ? (
                  <span className="text-small text-ink-soft shrink-0 font-mono">
                    {Math.round(result.ms)} ms
                  </span>
                ) : null}
              </div>
              {result !== undefined && !result.passed && result.message !== '' ? (
                <p className="text-small text-ink bg-danger rounded-input px-3 py-2 font-mono break-words">
                  {result.error?.line != null ? `Line ${result.error.line}: ` : ''}
                  {result.message}
                </p>
              ) : null}
              {showOutputs ? (
                <details className="group">
                  <summary className="text-small text-ink-soft hover:text-ink min-h-11 cursor-pointer py-2 font-medium">
                    Compare the outputs
                  </summary>
                  <div className="mt-2 flex flex-col gap-4">
                    {result.got != null ? (
                      <RunnerOutput title="Your output" output={result.got} />
                    ) : null}
                    {result.expected != null ? (
                      <RunnerOutput title="Expected" output={result.expected} />
                    ) : null}
                  </div>
                </details>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
