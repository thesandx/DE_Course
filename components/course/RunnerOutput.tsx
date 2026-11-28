import { cn } from '@/lib/utils';
import type { RunOutput } from '@/types/runner';

export interface RunnerOutputProps {
  /** What the output is: "Your output", "Expected". */
  title: string;
  output: RunOutput;
  className?: string;
}

/**
 * One result of a run: a table of rows, or a Python value as text. A table
 * scrolls inside its own box, so a wide result never widens the page.
 */
export function RunnerOutput({ title, output, className }: RunnerOutputProps) {
  return (
    <figure className={cn('flex min-w-0 flex-col gap-2', className)}>
      <figcaption className="text-small flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        {output.kind === 'table' ? (
          <span className="text-ink-soft font-mono">
            {output.total === output.rows.length
              ? `${output.total} ${output.total === 1 ? 'row' : 'rows'}`
              : `First ${output.rows.length} of ${output.total} rows`}
          </span>
        ) : null}
      </figcaption>
      {output.kind === 'table' ? (
        <div className="border-line rounded-input overflow-x-auto border">
          <table className="text-small w-full border-collapse text-left font-mono">
            <thead className="bg-sunken text-ink-soft">
              <tr>
                {output.columns.map((column, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="border-line border-b px-3 py-2 font-medium whitespace-nowrap"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {output.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-line border-b last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        'px-3 py-1.5 whitespace-nowrap',
                        cell === 'NULL' ? 'text-ink-faint italic' : 'text-ink',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {output.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, output.columns.length)}
                    className="text-ink-soft px-3 py-2"
                  >
                    No rows
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="bg-sunken border-line rounded-input text-small text-ink overflow-x-auto border px-3 py-2 font-mono whitespace-pre">
          {output.text}
        </pre>
      )}
    </figure>
  );
}
