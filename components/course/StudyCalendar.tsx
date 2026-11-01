import { activityGrid, type DayMap } from '@/lib/course/progress';
import { cn } from '@/lib/utils';

export interface StudyCalendarProps {
  days: DayMap;
  /** `YYYY-MM-DD`. */
  today: string;
  weeks?: number;
  className?: string;
}

const HEAT = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

function heat(count: number): string {
  return HEAT[Math.min(count, HEAT.length - 1)] ?? 'bg-heat-0';
}

/**
 * The study calendar: one square per day, a column per week, Monday at the
 * top. Each square has a title with the date and the count, and the sentence
 * under the grid gives the totals, so colour is never the only way to read it.
 */
export function StudyCalendar({ days, today, weeks = 16, className }: StudyCalendarProps) {
  const columns = activityGrid(days, today, weeks);
  const cells = columns.flat();
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  const activeDays = cells.filter((cell) => cell.count > 0).length;

  return (
    <figure className={cn('flex min-w-0 flex-col gap-4', className)}>
      <div className="flex justify-between gap-1" aria-hidden="true">
        {columns.map((column, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            {column.map((cell) => (
              <span
                key={cell.day}
                title={`${cell.day}: ${cell.count} finished`}
                className={cn('rounded-dot block size-2.5', heat(cell.count))}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="text-small text-ink-soft flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="text-ink font-semibold">{total} items</span> finished on {activeDays}{' '}
          days in the last {weeks} weeks.
        </span>
        <span
          className="text-micro text-ink-faint hidden items-center gap-1 sm:flex"
          aria-hidden="true"
        >
          less
          {HEAT.slice(0, 4).map((tone) => (
            <span key={tone} className={cn('rounded-dot block size-2', tone)} />
          ))}
          <span className="bg-heat-4 rounded-dot block size-2" />
          more
        </span>
      </figcaption>
    </figure>
  );
}
