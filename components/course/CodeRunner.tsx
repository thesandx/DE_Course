'use client';

import { useEffect, useId, useState } from 'react';

import { RunnerData } from '@/components/course/RunnerData';
import { RunnerOutput } from '@/components/course/RunnerOutput';
import { RunnerTests } from '@/components/course/RunnerTests';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { CodeEditor } from '@/components/ui/CodeEditor';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';
import { type RunnerState, useCodeRunner } from '@/hooks/useCodeRunner';
import { editorLanguage, ENGINES } from '@/lib/runner/engines';
import { cn } from '@/lib/utils';
import type { CaseResult, RunnableSpec, RunnerLanguage } from '@/types/runner';

export interface CodeRunnerProps {
  slug: string;
  spec: RunnableSpec;
  /** Keys the cached expected results: the slug and a hash of the spec. */
  runKey: string;
  /** The exact contract, rendered on the server from `spec.task`. */
  task: React.ReactNode;
  /** Called when a Submit passes every test. */
  onAccepted?: () => void;
  /** Called when a Submit finishes, with the tests that passed. */
  onChecked?: (passed: number, total: number) => void;
  /** Where this browser keeps the code. Default: one entry per problem. */
  storageKey?: string;
  /** What to do after every test passes. Default: mark it solved, then read the answer. */
  acceptedNote?: string;
}

type Panel = 'result' | 'tests' | 'data';

const LANGUAGE_NAMES: Record<RunnerLanguage, string> = {
  sql: 'SQL',
  python: 'Python',
  pyspark: 'PySpark',
};

const codeKey = (slug: string): string => `code:${slug}`;

function isAccepted(state: RunnerState, total: number): boolean {
  return (
    state.action === 'check' &&
    state.phase === 'done' &&
    state.cases.length === total &&
    state.cases.every((result) => result?.passed === true)
  );
}

function StatusLine({ state, language }: { state: RunnerState; language: RunnerLanguage }) {
  const engine = ENGINES[language];
  if (state.phase === 'loading') {
    return <Spinner size="sm" label={`${state.detail || `Loading ${engine.label}`}…`} />;
  }
  if (state.phase === 'running') {
    const done = state.cases.filter((result) => result !== undefined).length;
    return (
      <Spinner
        size="sm"
        label={
          state.total > 1
            ? `Running test ${Math.min(done + 1, state.total)} of ${state.total}…`
            : 'Running…'
        }
      />
    );
  }
  if (state.phase === 'idle') {
    return (
      <p className="text-small text-ink-soft">
        Runs in your browser on {engine.label}. The first run downloads {engine.download}.
      </p>
    );
  }
  const ms = state.cases.reduce((sum, result) => sum + (result?.ms ?? 0), 0);
  return (
    <p className="text-small text-ink-soft" role="status">
      {state.phase === 'ready'
        ? `${engine.label} is ready.`
        : state.phase === 'failed'
          ? 'The run did not finish.'
          : `${engine.label} · ${Math.round(ms)} ms`}
    </p>
  );
}

function Verdict({ result }: { result: CaseResult }) {
  return (
    <p
      className={cn(
        'rounded-input flex items-start gap-2 px-3 py-2 font-semibold',
        result.passed ? 'bg-success' : 'bg-danger',
      )}
    >
      <span aria-hidden="true">{result.passed ? '✓' : '✗'}</span>
      <span>
        {result.passed ? 'The sample case passes.' : 'The sample case fails.'}
        {result.passed ? (
          <span className="text-small block font-normal">
            Submit to run every test, the hidden ones too.
          </span>
        ) : null}
      </span>
    </p>
  );
}

function ResultPanel({ state }: { state: RunnerState }) {
  if (state.action === null) {
    return (
      <p className="text-small text-ink-soft">
        Run checks your code on the sample data and shows its output next to the expected one.
      </p>
    );
  }
  if (state.phase === 'failed') {
    return (
      <Alert tone="danger" title="The run did not finish.">
        {state.error}
      </Alert>
    );
  }
  const result = state.cases[0];
  if (result === undefined) {
    return <Spinner size="sm" label="Waiting for the first result…" />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Verdict result={result} />
      {!result.passed && result.message !== '' ? (
        <p className="text-small bg-sunken rounded-input px-3 py-2 font-mono break-words">
          {result.error?.line != null ? `Line ${result.error.line}: ` : ''}
          {result.message}
        </p>
      ) : null}
      {result.got != null ? <RunnerOutput title="Your output" output={result.got} /> : null}
      {result.expected != null ? (
        result.passed ? (
          <details>
            <summary className="text-small text-ink-soft hover:text-ink min-h-11 cursor-pointer py-2 font-medium">
              Show the expected output
            </summary>
            <RunnerOutput title="Expected" output={result.expected} className="mt-2" />
          </details>
        ) : (
          <RunnerOutput title="Expected" output={result.expected} />
        )
      ) : null}
      {result.stdout !== '' ? (
        <RunnerOutput title="Printed" output={{ kind: 'text', text: result.stdout }} />
      ) : null}
    </div>
  );
}

/**
 * The runnable editor on a coding problem, in the shape of an interview's
 * shared editor: the contract, the code, Run for the sample case and Submit
 * for every test. The code runs in a Web Worker in the browser (ADR-0016),
 * so a run costs no server time and works the same for every learner.
 *
 * The code stays in this browser (localStorage), like the written drafts.
 */
export function CodeRunner({
  slug,
  spec,
  runKey,
  task,
  onAccepted,
  onChecked,
  storageKey = codeKey(slug),
  acceptedNote = 'The hidden tests pass too. Mark the problem solved below, then compare with the model answer.',
}: CodeRunnerProps) {
  const [code, setCode] = useState(spec.starter);
  const [beforeReset, setBeforeReset] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('data');
  const { state, warm, run, stop } = useCodeRunner(spec, runKey);
  const helpId = useId();
  const language = spec.language;
  const accepted = isAccepted(state, spec.cases.length);
  const busy = state.phase === 'running' || (state.phase === 'loading' && state.action !== null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      // Reading browser storage is only possible after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restores saved code once, on mount
      if (saved !== null && saved.trim() !== '') setCode(saved);
    } catch {
      // Storage can be blocked (private mode). The code then lives in memory only.
      return;
    }
  }, [storageKey]);

  useEffect(() => {
    if (accepted) onAccepted?.();
  }, [accepted, onAccepted]);

  const checkedCount =
    state.action === 'check' && state.phase === 'done'
      ? state.cases.filter((result) => result?.passed === true).length
      : null;
  useEffect(() => {
    if (checkedCount !== null) onChecked?.(checkedCount, spec.cases.length);
  }, [checkedCount, onChecked, spec.cases.length]);

  function save(value: string): void {
    setCode(value);
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Storage can be blocked or full. The code stays in memory.
      return;
    }
  }

  function edit(value: string): void {
    setBeforeReset(null);
    save(value);
  }

  function start(action: 'run' | 'check'): void {
    if (busy) return;
    run(action, code);
    setPanel(action === 'run' ? 'result' : 'tests');
  }

  function reset(): void {
    setBeforeReset(code);
    save(spec.starter);
  }

  const errorLine = state.cases.find((result) => result?.error?.line != null)?.error?.line ?? null;
  const submitted = state.action === 'check';

  return (
    <section
      aria-labelledby={`${helpId}-title`}
      className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-4 border p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="eyebrow text-ink-soft">Runs in your browser</p>
          <h2 id={`${helpId}-title`} className="text-heading flex items-center gap-2">
            <span>Code it in {LANGUAGE_NAMES[language]}</span>
            <span className="border-line rounded-pill text-micro text-ink-soft border px-2 py-0.5 font-mono font-medium">
              {ENGINES[language].label}
            </span>
          </h2>
        </div>
        {beforeReset !== null ? (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              save(beforeReset);
              setBeforeReset(null);
            }}
          >
            Undo reset
          </Button>
        ) : (
          <Button variant="quiet" size="sm" onClick={reset} disabled={code === spec.starter}>
            Reset code
          </Button>
        )}
      </header>

      <div className="bg-sunken rounded-input text-small flex flex-col gap-2 px-4 py-3">
        <p className="eyebrow text-ink-soft">Your task</p>
        {task}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <CodeEditor
          value={code}
          onChange={edit}
          language={editorLanguage(language)}
          label={`${LANGUAGE_NAMES[language]} editor`}
          onRun={() => start('run')}
          onSubmit={() => start('check')}
          onFocus={warm}
          errorLine={errorLine}
          describedBy={helpId}
          minLines={12}
        />
        <p id={helpId} className="text-small text-ink-faint hidden sm:block">
          Ctrl or ⌘ + Enter runs · add Shift to submit · Tab indents · Esc, then Tab, leaves the
          editor
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" onClick={() => start('run')} disabled={busy}>
            Run
          </Button>
          <Button variant="dark" onClick={() => start('check')} disabled={busy}>
            Submit
          </Button>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 sm:justify-end">
          <StatusLine state={state} language={language} />
          {busy ? (
            <Button variant="quiet" size="sm" onClick={stop}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      {accepted ? (
        <Alert tone="success" title={`Accepted. All ${spec.cases.length} tests pass.`}>
          {acceptedNote}
        </Alert>
      ) : null}

      <Tabs
        label="Results"
        value={panel}
        onChange={(id) => setPanel(id as Panel)}
        items={[
          { id: 'result', label: 'Result', content: <ResultPanel state={state} /> },
          {
            id: 'tests',
            label: 'Tests',
            content: (
              <RunnerTests
                cases={spec.cases}
                results={submitted ? state.cases : []}
                running={submitted && busy}
              />
            ),
          },
          {
            id: 'data',
            label: 'Data',
            content: (
              <RunnerData
                tables={spec.tables ?? []}
                language={language}
                {...(spec.setup !== undefined ? { setup: spec.setup } : {})}
              />
            ),
          },
        ]}
      />
    </section>
  );
}
