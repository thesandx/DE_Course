import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RUN_TIMEOUT_MS } from '@/lib/runner/engines';
import type { CaseResult, RunnableSpec, WorkerEvent, WorkerRequest } from '@/types/runner';

/**
 * The hook with a fake Worker: each test plays the worker's side of the
 * conversation. The hook keeps one worker per engine for the whole visit, so
 * every test loads a fresh copy of the module.
 */

class FakeWorker {
  static all: FakeWorker[] = [];
  readonly sent: WorkerRequest[] = [];
  readonly name: string;
  terminated = false;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(_url: URL, options: { name: string }) {
    this.name = options.name;
    FakeWorker.all.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(request: WorkerRequest): void {
    this.sent.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** The worker answers the page. */
  reply(event: WorkerEvent): void {
    act(() => {
      for (const listener of this.listeners.get('message') ?? []) listener({ data: event });
    });
  }

  crash(): void {
    act(() => {
      for (const listener of this.listeners.get('error') ?? []) listener(new Event('error'));
    });
  }

  get lastId(): number {
    const last = this.sent.at(-1);
    if (last === undefined) throw new Error('Nothing was sent.');
    return last.id;
  }
}

const SPEC: RunnableSpec = {
  language: 'sql',
  task: 'Return 1.',
  starter: '',
  solution: 'SELECT 1',
  cases: [{ name: 'Sample' }, { name: 'Ties' }, { name: 'Big fleet', hidden: true }],
};

function passed(name: string): CaseResult {
  return { name, note: '', hidden: false, passed: true, message: '', stdout: '', ms: 3 };
}

async function load() {
  const hook = await import('@/hooks/useCodeRunner');
  return hook.useCodeRunner;
}

describe('useCodeRunner', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeWorker.all = [];
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('warms the engine once, without a clock', async () => {
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.warm());
    const worker = FakeWorker.all[0];
    expect(worker?.name).toBe('sql-runner');
    expect(worker?.sent[0]).toMatchObject({ action: 'warm', language: 'sql' });
    expect(result.current.state.phase).toBe('loading');

    worker?.reply({
      type: 'status',
      id: worker.lastId,
      phase: 'loading',
      detail: 'Loading PostgreSQL 18',
    });
    expect(result.current.state.detail).toBe('Loading PostgreSQL 18');
    worker?.reply({
      type: 'status',
      id: worker.lastId,
      phase: 'ready',
      detail: 'PostgreSQL 18 is ready',
    });
    expect(result.current.state.phase).toBe('ready');

    // A second warm-up does nothing once the engine is warm.
    act(() => result.current.warm());
    expect(worker?.sent).toHaveLength(1);
  });

  it('runs the sample and reports each case as it lands', async () => {
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.run('run', 'SELECT 1'));
    const worker = FakeWorker.all[0];
    expect(worker?.sent[0]).toMatchObject({ action: 'run', key: 'p:1', code: 'SELECT 1' });
    expect(result.current.state).toMatchObject({ phase: 'loading', action: 'run', total: 1 });

    const id = worker?.lastId ?? 0;
    worker?.reply({ type: 'status', id, phase: 'running', detail: 'Running your query' });
    expect(result.current.state.phase).toBe('running');
    worker?.reply({ type: 'case', id, index: 0, result: passed('Sample') });
    expect(result.current.state.cases[0]?.passed).toBe(true);
    // A message for another request is not this run's.
    worker?.reply({ type: 'failed', id: id + 100, message: 'not mine' });
    expect(result.current.state.phase).toBe('running');
    worker?.reply({ type: 'done', id, cases: [passed('Sample')] });
    expect(result.current.state).toMatchObject({ phase: 'done', detail: '' });
  });

  it('submits every case, and reports a failed run', async () => {
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.run('check', 'SELECT 1'));
    expect(result.current.state.total).toBe(3);
    const worker = FakeWorker.all[0];
    worker?.reply({ type: 'failed', id: worker.lastId, message: 'PGlite did not load.' });
    expect(result.current.state).toMatchObject({ phase: 'failed', error: 'PGlite did not load.' });
  });

  it('ignores a second run while one is in flight', async () => {
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.run('run', 'SELECT 1'));
    act(() => result.current.run('check', 'SELECT 2'));
    expect(FakeWorker.all[0]?.sent).toHaveLength(1);
  });

  it('stops a run that passes the time limit and names the test', async () => {
    vi.useFakeTimers();
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.run('check', 'SELECT pg_sleep(60)'));
    const worker = FakeWorker.all[0];
    const id = worker?.lastId ?? 0;
    worker?.reply({ type: 'status', id, phase: 'running', detail: 'Running your query' });
    worker?.reply({ type: 'case', id, index: 0, result: passed('Sample') });
    act(() => {
      vi.advanceTimersByTime(RUN_TIMEOUT_MS);
    });
    expect(worker?.terminated).toBe(true);
    expect(result.current.state.phase).toBe('failed');
    expect(result.current.state.error).toMatch(
      /^Test 2 of 3 \(Ties\) was still running after 25 seconds, so it was stopped\./,
    );

    // The next run starts a new worker.
    act(() => result.current.run('run', 'SELECT 1'));
    expect(FakeWorker.all).toHaveLength(2);
  });

  it('says "your code" when the only test times out', async () => {
    vi.useFakeTimers();
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.run('run', 'loop'));
    const worker = FakeWorker.all[0];
    worker?.reply({ type: 'status', id: worker.lastId, phase: 'running', detail: '' });
    act(() => {
      vi.advanceTimersByTime(RUN_TIMEOUT_MS);
    });
    expect(result.current.state.error).toMatch(/^Your code was still running after 25 seconds/);
  });

  it('does not time out a run that finished', async () => {
    vi.useFakeTimers();
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.run('run', 'SELECT 1'));
    const worker = FakeWorker.all[0];
    const id = worker?.lastId ?? 0;
    worker?.reply({ type: 'status', id, phase: 'running', detail: '' });
    worker?.reply({ type: 'done', id, cases: [passed('Sample')] });
    act(() => {
      vi.advanceTimersByTime(RUN_TIMEOUT_MS * 2);
    });
    expect(result.current.state.phase).toBe('done');
    expect(worker?.terminated).toBe(false);
  });

  it('stops on request', async () => {
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.stop());
    expect(result.current.state.phase).toBe('idle');
    act(() => result.current.run('run', 'SELECT 1'));
    act(() => result.current.stop());
    expect(FakeWorker.all[0]?.terminated).toBe(true);
    expect(result.current.state).toMatchObject({ phase: 'failed', error: 'Stopped.' });
  });

  it('reports a worker that crashed', async () => {
    const useCodeRunner = await load();
    const { result } = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => result.current.run('run', 'SELECT 1'));
    FakeWorker.all[0]?.crash();
    expect(FakeWorker.all[0]?.terminated).toBe(true);
    expect(result.current.state.error).toMatch(/stopped unexpectedly/);
  });

  it('stops a run when the page goes away, but keeps a warm engine', async () => {
    const useCodeRunner = await load();
    const first = renderHook(() => useCodeRunner(SPEC, 'p:1'));
    act(() => first.result.current.warm());
    first.unmount();
    expect(FakeWorker.all[0]?.terminated).toBe(false);

    const second = renderHook(() => useCodeRunner(SPEC, 'p:2'));
    act(() => second.result.current.run('run', 'SELECT 1'));
    // The same worker serves the next page.
    expect(FakeWorker.all).toHaveLength(1);
    second.unmount();
    expect(FakeWorker.all[0]?.terminated).toBe(true);
  });

  it('shares one Python worker between Python and PySpark', async () => {
    const useCodeRunner = await load();
    const python = renderHook(() => useCodeRunner({ ...SPEC, language: 'python' }, 'a:1'));
    act(() => python.result.current.warm());
    const spark = renderHook(() =>
      useCodeRunner({ ...SPEC, language: 'pyspark', modules: ['prefect'] }, 'b:1'),
    );
    act(() => spark.result.current.run('run', 'df.show()'));
    expect(FakeWorker.all).toHaveLength(1);
    expect(FakeWorker.all[0]?.name).toBe('python-runner');
  });
});
