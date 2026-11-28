# ADR-0016: Run the learner's code in the browser, on engines from a CDN

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** repository owner

## Context

The owner asked for an editor on every coding problem of the DE course, for SQL, Python and Spark, so that the course needs no other site. 78 problems are SQL or coding problems. On each one, a learner writes code, runs it on sample data, and submits it to tests. Some tests are hidden.

Constraints:

- Code from a learner is untrusted. To run it on a server, each run needs a sandbox with limits on CPU, memory, network and time. Cloud Run runs one container image on a read-only root filesystem.
- Most learners use a phone.
- The app has no budget for a code-execution service.
- Every learner must get the same result for the same code. A new engine version must not change a result without a change in this repository.
- The production image is about 64 MB compressed. The engines are 5 to 15 MB each.

## Decision

We will run the learner's code in the browser, in a Web Worker, on engines compiled to WebAssembly:

- **SQL:** PGlite 0.5.15, which is PostgreSQL 18.
- **Python:** Pyodide 314.0.7, which is CPython 3.14, with pandas 3.0.2 and DuckDB 1.5.1 from its package set.
- **PySpark:** our own module, `hooks/workers/python/pyspark_shim.py`. It runs the common DataFrame API on DuckDB, inside Pyodide.
- **Orchestration and tests:** small look-alikes of Prefect 3, Airflow 3 and pytest, in `hooks/workers/python/`. The Prefect and Airflow look-alikes run on a simulated clock.

The workers load the engines from `cdn.jsdelivr.net` at the first run, at the versions pinned in `lib/runner/engines.ts`. The app bundle and the image do not contain the engines. The browser caches them after the first run.

Each problem has a spec in `lib/course/runnables/`: sample data, a reference solution and test cases. The judge runs the learner's code and the reference on the same data, then compares the results (`lib/runner/sql-judge.ts` and `hooks/workers/python/harness.py`). Run uses the first case. Submit runs every case, the hidden ones too.

The tests prove every spec:

- `sql-specs.test.ts` runs each SQL spec on PGlite from `node_modules`.
- `python-specs.test.ts` runs each Python and PySpark spec on CPython 3.13, with the DuckDB and pandas versions that Pyodide ships.
- For each spec, known right answers must pass and known usual mistakes must fail (`test-answers.ts`).
- The written model answer of each problem must pass its own tests (`written-answers.ts`).

## Alternatives considered

### Option A — engines in the browser (chosen)

No code runs on our servers, so there is no sandbox to build and no cost for each run. A run is private, and it works offline after the first download. A phone runs the same engine as a laptop.

### Option B — a code-execution service

A hosted judge, or a Cloud Run job for each run, could run real Spark and real Python. But each run needs a sandbox, each run costs money, a cold start adds seconds, and an open endpoint that runs code invites abuse such as mining. The service also needs a credential and a new failure path.

### Option C — DuckDB-WASM or SQLite for SQL

DuckDB-WASM is smaller and faster. SQLite (sql.js) is smaller again. But interviews ask for PostgreSQL-like SQL, and both differ from it in ways that interviews test. DuckDB divides two integers into a decimal result, where PostgreSQL truncates. SQLite has no date type. PGlite is PostgreSQL itself.

### Option D — real PySpark, or DuckDB's Spark API

Real PySpark needs a JVM, which does not run in the browser at a usable size. DuckDB has an experimental Spark API, but it covers less of the DataFrame API and gives us no control of errors or plans. Our own module can print a plan with `explain()`, count the partitions that a query reads, and give Spark-like error messages.

### Option E — engines in the app bundle

This also runs code in the browser. But the bundle and the image grow by tens of megabytes, and the build must process the WebAssembly files. The CDN gives the same files with long cache headers.

## Consequences

**Good**

- No code from a learner runs on a server, and a run costs nothing.
- The editor works offline after the first run.
- CI proves each grader with right and wrong answers, so a spec that accepts a wrong answer fails a test.

**Bad**

- The first run downloads 5 to 15 MB. On a slow phone network, this takes time. The editor says so before the first run.
- The CDN is a runtime dependency. If it is down or blocked, for example on a company network, the editor shows an error. The written answer and the model answer still work.
- The PySpark module is not Spark. It has no partitions, shuffles or RDDs, and `explain()` prints a small plan. A frame from `spark.sql(...)` has no scan lineage, so a check for partition pruning asks for the DataFrame API. DuckDB can order rows with equal sort keys differently from Spark, so the specs avoid equal sort keys where the order changes a result.
- The reference solution and the hidden data reach the browser. A learner can read them. The editor is for practice, not for a graded exam.
- The Python spec tests need Python, DuckDB and pandas. Without them, the suite skips. CI installs them.

**Neutral**

- `@electric-sql/pglite` is a dev dependency only, for its types and for the SQL spec tests.

## Revisit when

- A pinned engine version gets a security fix. Update the pin, then run the spec suites.
- The CDN removes a pinned version.
- The owner wants graded exams. Then a server must judge, because the browser cannot keep a secret.
- Spark runs in WebAssembly at a usable size.

## References

- `lib/runner/engines.ts`, `hooks/workers/`, `lib/course/runnables/`
- `lib/course/README.md` > Runnable problems
- PGlite: <https://pglite.dev>
- Pyodide: <https://pyodide.org>
