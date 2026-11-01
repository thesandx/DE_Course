import { activityGrid, type DayMap } from '@/lib/course/progress';
import { cn } from '@/lib/utils';

export interface ActivityGridProps {
  days: DayMap;
  /** `YYYY-MM-DD`, the last day shown. */
  today: string;
  weeks?: number;
  className?: string;
}

function cellClass(count: number): string {
  if (count === 0) return 'bg-sunken';
  if (count === 1) return 'bg-brand-soft';
  if (count === 2) return 'bg-brand';
  return 'bg-ink';
}

/**
 * The study calendar: one square per day, a column per week, like a
 * contribution graph. Each square has a title with the date and the count,
 * and a sentence under the grid gives the total, so the colour is never the
 * only way to read it.
 */
export function ActivityGrid({ days, today, weeks = 16, className }: ActivityGridProps) {
  const columns = activityGrid(days, today, weeks);
  const total = columns.flat().reduce((sum, cell) => sum + cell.count, 0);
  const activeDays = columns.flat().filter((cell) => cell.count > 0).length;

  return (
    <figure className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex gap-1" aria-hidden="true">
        {columns.map((column, index) => (
          <div key={index} className="flex flex-1 flex-col gap-1">
            {column.map((cell) => (
              <span
                key={cell.day}
                title={`${cell.day}: ${cell.count} finished`}
                className={cn('block aspect-square w-full', cellClass(cell.count))}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="text-small text-ink-soft">
        {total} items finished on {activeDays} days in the last {weeks} weeks.
      </figcaption>
    </figure>
  );
}
