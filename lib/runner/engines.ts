import type { RunnerLanguage } from '@/types/runner';

/**
 * The engines that run a learner's code in the browser, and where they come
 * from. ADR-0016 records the choice. Pin exact versions: a moving version
 * would change the results under every spec without a code change.
 */

/** PostgreSQL 18 compiled to WebAssembly. */
export const PGLITE_VERSION = '0.5.15';
export const PGLITE_URL = `https://cdn.jsdelivr.net/npm/@electric-sql/pglite@${PGLITE_VERSION}/dist/index.js`;

/** CPython 3.14 compiled to WebAssembly, with pandas 3.0 and DuckDB 1.5 in its package set. */
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/**
 * A run that takes longer than this is stopped, and the engine restarts. The
 * clock starts when the engine is ready, so a slow first download does not
 * count against the learner's code.
 */
export const RUN_TIMEOUT_MS = 25_000;

export interface EngineInfo {
  /** The name the learner sees on the editor. */
  label: string;
  /** What the first run downloads. The browser keeps it afterwards. */
  download: string;
}

export const ENGINES: Record<RunnerLanguage, EngineInfo> = {
  sql: { label: 'PostgreSQL 18', download: 'about 5 MB' },
  python: { label: 'Python 3.14', download: 'about 6 MB, or 13 MB with pandas' },
  pyspark: { label: 'PySpark API on DuckDB', download: 'about 15 MB' },
};

/** The editor's highlighting and indentation follow the language, not the engine. */
export function editorLanguage(language: RunnerLanguage): 'sql' | 'python' {
  return language === 'sql' ? 'sql' : 'python';
}
