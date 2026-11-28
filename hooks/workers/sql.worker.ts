import type { PGlite } from '@electric-sql/pglite';

import { ENGINES, PGLITE_URL } from '@/lib/runner/engines';
import { pgliteEngine } from '@/lib/runner/pglite-engine';
import { type ExpectedCache, judgeSql, type SqlEngine } from '@/lib/runner/sql-judge';
import type { WorkerEvent, WorkerRequest } from '@/types/runner';

/**
 * Runs SQL in the browser on PostgreSQL 18 (PGlite), off the main thread.
 * `useCodeRunner` starts it and stops it when a run takes too long.
 *
 * PGlite loads from the CDN at run time, not from the bundle: see ADR-0016.
 * The npm package is a dev dependency only, for its types and for the tests.
 */

interface PGliteModule {
  PGlite: typeof PGlite;
}

const cache: ExpectedCache = new Map();
let engine: Promise<SqlEngine> | null = null;
let queue: Promise<void> = Promise.resolve();

function post(event: WorkerEvent): void {
  self.postMessage(event);
}

async function start(): Promise<SqlEngine> {
  const { PGlite: Engine } = (await import(/* webpackIgnore: true */ PGLITE_URL)) as PGliteModule;
  return pgliteEngine(await Engine.create());
}

async function handle(request: WorkerRequest): Promise<void> {
  const { id } = request;
  try {
    if (engine === null) {
      post({ type: 'status', id, phase: 'loading', detail: `Loading ${ENGINES.sql.label}` });
      engine = start();
    }
    const ready = await engine.catch((caught: unknown) => {
      engine = null;
      throw caught;
    });
    if (request.action === 'warm') {
      post({ type: 'status', id, phase: 'ready', detail: `${ENGINES.sql.label} is ready` });
      return;
    }
    post({ type: 'status', id, phase: 'running', detail: 'Running your query' });
    const cases = await judgeSql(request, {
      engine: ready,
      cache,
      onCase: (index, result) => post({ type: 'case', id, index, result }),
    });
    post({ type: 'done', id, cases });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    post({ type: 'failed', id, message });
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  // One request at a time: a second Run waits for the first to finish.
  queue = queue.then(() => handle(event.data));
});
