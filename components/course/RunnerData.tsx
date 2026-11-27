import { CodeBlock } from '@/components/ui/CodeBlock';
import type { DataCell, DataTable } from '@/types/runner';

export interface RunnerDataProps {
  tables: readonly DataTable[];
  /** Python: the inputs and helpers the code starts with. SQL: statements after the tables load. */
  setup?: string;
  language: 'sql' | 'python' | 'pyspark';
}

const MAX_ROWS = 30;

function showCell(cell: DataCell): string {
  if (cell === null) return 'NULL';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  return JSON.stringify(cell);
}

function frameNoun(language: RunnerDataProps['language']): string {
  if (language === 'sql') return 'Table';
  return language === 'pyspark' ? 'DataFrame' : 'pandas DataFrame';
}

/**
 * The sample data a problem starts with: each table with its column types,
 * and for Python the inputs the code can read. Hidden test data stays hidden.
 */
export function RunnerData({ tables, setup, language }: RunnerDataProps) {
  if (tables.length === 0 && (setup === undefined || setup.trim() === '')) {
    return (
      <p className="text-small text-ink-soft">
        This problem has no sample data. The tests call your code with their own inputs.
      </p>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {tables.map((table) => (
        <figure key={table.name} className="flex min-w-0 flex-col gap-2">
          <figcaption className="text-small flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span>
              <span className="text-ink-soft">{frameNoun(language)} </span>
              <code className="text-ink font-mono font-semibold">{table.name}</code>
            </span>
            <span className="text-ink-soft font-mono">
              {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}
            </span>
          </figcaption>
          <div className="border-line rounded-input overflow-x-auto border">
            <table className="text-small w-full border-collapse text-left font-mono">
              <thead className="bg-sunken">
                <tr>
                  {table.columns.map((column) => (
                    <th
                      key={column.name}
                      scope="col"
                      className="border-line border-b px-3 py-2 align-bottom whitespace-nowrap"
                    >
                      <span className="text-ink block font-medium">{column.name}</span>
                      <span className="text-ink-faint block font-normal">{column.type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, MAX_ROWS).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-line border-b last:border-b-0">
                    {table.columns.map((column, cellIndex) => {
                      const cell = row[cellIndex] ?? null;
                      return (
                        <td
                          key={column.name}
                          className={
                            cell === null
                              ? 'text-ink-faint px-3 py-1.5 whitespace-nowrap italic'
                              : 'text-ink px-3 py-1.5 whitespace-nowrap'
                          }
                        >
                          {showCell(cell)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.rows.length > MAX_ROWS ? (
            <p className="text-small text-ink-soft">
              {table.rows.length - MAX_ROWS} more rows are loaded but not shown.
            </p>
          ) : null}
        </figure>
      ))}
      {setup !== undefined && setup.trim() !== '' ? (
        <CodeBlock
          code={setup.trim()}
          lang={language === 'sql' ? 'sql' : 'python'}
          title={language === 'sql' ? 'Runs before your query' : 'Inputs your code can use'}
        />
      ) : null}
    </div>
  );
}
