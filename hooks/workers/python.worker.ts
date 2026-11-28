import { jobSource, pythonJob } from '@/lib/runner/data';
import { ENGINES, PYODIDE_BASE_URL } from '@/lib/runner/engines';
import type {
  CaseResult,
  RunnerLanguage,
  SandboxModule,
  WorkerEvent,
  WorkerRequest,
} from '@/types/runner';

/**
 * Runs Python and PySpark in the browser on CPython 3.14 (Pyodide), off the
 * main thread. PySpark code runs on `pyspark_shim.py`, which compiles the
 * DataFrame API to DuckDB SQL. `harness.py` runs the learner's code and the
 * reference solution and compares them.
 *
 * Pyodide loads from the CDN at run time, not from the bundle: see ADR-0016.
 * The Python files next to this worker are bundled as static assets, so they
 * always match the worker that loads them.
 */

/** The part of the Pyodide API this worker uses. */
interface Pyodide {
  loadPackage(
    names: readonly string[],
    options?: { messageCallback?: (message: string) => void },
  ): Promise<unknown>;
  loadPackagesFromImports(
    code: string,
    options?: { messageCallback?: (message: string) => void },
  ): Promise<unknown>;
  runPython(code: string): unknown;
  pyimport(name: string): Harness;
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: string): void;
  };
}

interface Harness {
  run_job(job: string, emit: (event: string) => void): string;
  register_module(name: string, source: string): void;
}

interface PyodideModule {
  loadPyodide(options: {
    indexURL: string;
    stdin?: () => string | null;
    stdout?: (line: string) => void;
    stderr?: (line: string) => void;
  }): Promise<Pyodide>;
}

const RUNNER_DIR = '/runner';

const SOURCES = {
  harness: new URL('./python/harness.py', import.meta.url),
  pyspark_shim: new URL('./python/pyspark_shim.py', import.meta.url),
  prefect: new URL('./python/prefect_sandbox.py', import.meta.url),
  airflow: new URL('./python/airflow_sandbox.py', import.meta.url),
  pytest: new URL('./python/pytest_sandbox.py', import.meta.url),
} as const;

let engine: Promise<{ pyodide: Pyodide; harness: Harness }> | null = null;
const registered = new Set<SandboxModule>();
let sparkReady = false;
let queue: Promise<void> = Promise.resolve();

function post(event: WorkerEvent): void {
  self.postMessage(event);
}

async function source(url: URL): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Could not load ${url.pathname} (HTTP ${response.status}).`);
  return response.text();
}

/**
 * Turbopack starts every worker as a classic script, and Pyodide 314 refuses
 * a classic worker: when its module loads, it calls `importScripts()` and
 * stops if the call works. Pyodide itself needs only `import()`, which a
 * classic worker has too. So `importScripts` throws, as it does in a module
 * worker, while Pyodide loads and starts.
 */
async function loadPyodideInWorker(): Promise<Pyodide> {
  const scope = globalThis as unknown as {
    importScripts: ((...urls: string[]) => void) | undefined;
  };
  const original = scope.importScripts;
  scope.importScripts = () => {
    throw new TypeError('Module scripts do not support importScripts().');
  };
  try {
    const url = `${PYODIDE_BASE_URL}pyodide.mjs`;
    const { loadPyodide } = (await import(/* webpackIgnore: true */ url)) as PyodideModule;
    return await loadPyodide({
      indexURL: PYODIDE_BASE_URL,
      // input() reads end of file instead of opening a prompt the worker cannot show.
      stdin: () => null,
      // The harness captures the learner's output itself; this is engine noise.
      stdout: () => undefined,
      stderr: () => undefined,
    });
  } finally {
    scope.importScripts = original;
  }
}

async function start(): Promise<{ pyodide: Pyodide; harness: Harness }> {
  const [pyodide, harnessSource] = await Promise.all([
    loadPyodideInWorker(),
    source(SOURCES.harness),
  ]);
  pyodide.FS.mkdirTree(RUNNER_DIR);
  pyodide.FS.writeFile(`${RUNNER_DIR}/harness.py`, harnessSource);
  pyodide.runPython(
    `import sys\nif ${JSON.stringify(RUNNER_DIR)} not in sys.path: sys.path.insert(0, ${JSON.stringify(RUNNER_DIR)})`,
  );
  return { pyodide, harness: pyodide.pyimport('harness') };
}

/** Loads what a language needs: DuckDB and the PySpark shim, or the sandbox libraries. */
async function prepare(
  pyodide: Pyodide,
  harness: Harness,
  language: RunnerLanguage,
  modules: readonly SandboxModule[],
  code: string,
  id: number,
): Promise<void> {
  const progress = (message: string): void => {
    if (message.startsWith('Loading'))
      post({ type: 'status', id, phase: 'loading', detail: message });
  };
  const packages: string[] = [];
  if (language === 'pyspark' && !sparkReady) packages.push('duckdb');
  if (/\bpandas\b|toPandas/.test(code)) packages.push('pandas');
  if (packages.length > 0) await pyodide.loadPackage(packages, { messageCallback: progress });
  if (code !== '') await pyodide.loadPackagesFromImports(code, { messageCallback: progress });
  if (language === 'pyspark' && !sparkReady) {
    pyodide.FS.writeFile(`${RUNNER_DIR}/pyspark_shim.py`, await source(SOURCES.pyspark_shim));
    pyodide.runPython('import pyspark_shim');
    sparkReady = true;
  }
  for (const name of modules) {
    if (registered.has(name)) continue;
    harness.register_module(name, await source(SOURCES[name]));
    registered.add(name);
  }
}

async function handle(request: WorkerRequest): Promise<void> {
  const { id } = request;
  try {
    if (engine === null) {
      post({ type: 'status', id, phase: 'loading', detail: `Loading ${ENGINES.python.label}` });
      engine = start();
    }
    const { pyodide, harness } = await engine.catch((caught: unknown) => {
      engine = null;
      throw caught;
    });
    if (request.action === 'warm') {
      await prepare(pyodide, harness, request.language, request.modules ?? [], '', id);
      post({
        type: 'status',
        id,
        phase: 'ready',
        detail: `${ENGINES[request.language].label} is ready`,
      });
      return;
    }
    const job = pythonJob(request);
    await prepare(pyodide, harness, job.language, job.modules, jobSource(job), id);
    post({ type: 'status', id, phase: 'running', detail: 'Running your code' });
    const output = harness.run_job(JSON.stringify(job), (event) => {
      const parsed = JSON.parse(event) as { index: number; result: CaseResult };
      post({ type: 'case', id, index: parsed.index, result: parsed.result });
    });
    const { cases } = JSON.parse(output) as { cases: CaseResult[] };
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
