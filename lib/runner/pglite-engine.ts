import type { PGlite } from '@electric-sql/pglite';

import type { SqlEngine } from '@/lib/runner/sql-judge';

/**
 * The SQL judge's engine on a PGlite database. The browser worker passes a
 * PGlite loaded from the CDN; the tests pass one from `node_modules`, so the
 * tests check exactly what the learner's browser runs.
 */

/** Drops every schema the learner or the sample data made, then makes `public` again. */
const DROP_SCHEMAS = `DO $$
DECLARE s text;
BEGIN
  FOR s IN SELECT nspname FROM pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND nspname NOT LIKE 'pg\\_temp\\_%' AND nspname NOT LIKE 'pg\\_toast\\_temp\\_%'
  LOOP
    EXECUTE format('DROP SCHEMA %I CASCADE', s);
  END LOOP;
END $$;
CREATE SCHEMA public;`;

export async function pgliteEngine(db: PGlite): Promise<SqlEngine> {
  // Every type comes back as the text PostgreSQL prints, as in psql. The
  // comparison then reads numbers by type, so 12.50 and 12.5 are equal.
  const types = await db.query<{ oid: number }>('SELECT oid::int AS oid FROM pg_type');
  const parsers = Object.fromEntries(types.rows.map((row) => [row.oid, (value: string) => value]));
  return {
    async exec(sql) {
      const results = await db.exec(sql, { rowMode: 'array', parsers });
      return results.map((result) => ({
        fields: result.fields,
        rows: result.rows as unknown as (string | null)[][],
      }));
    },
    async reset() {
      // A failed transaction blocks every later statement until a rollback.
      await db.exec('ROLLBACK');
      // DISCARD ALL cannot run inside the implicit block of a multi-statement exec.
      await db.exec('DISCARD ALL');
      await db.exec(DROP_SCHEMAS);
    },
  };
}
