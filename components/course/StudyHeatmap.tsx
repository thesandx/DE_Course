'use client';

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { Icon } from '@/components/layout/Icon';
import { localDay } from '@/hooks/useRecordProgress';
import {
  buildStudyMap,
  describeStudyDay,
  formatStudyTime,
  type StudyActivity,
  type StudyDay,
} from '@/lib/course/study-time';
import { cn } from '@/lib/utils';

export interface StudyHeatmapProps {
  activity: StudyActivity;
  /** `YYYY-MM-DD` on the server. The map moves to the learner's local day after it loads. */
  today: string;
  className?: string;
}

const HEAT = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

/** Row labels, Monday first. Only every other row has one, as on a contribution graph. */
const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const;

/** Arrow keys move a day (up and down) or a week (left and right). */
const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowUp: -1,
  ArrowDown: 1,
  ArrowLeft: -7,
  ArrowRight: 7,
};

/** The local day never needs a re-render while the page is open, so nothing subscribes. */
function subscribeNever(): () => void {
  return () => undefined;
}

function days(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: 'flame' }) {
  return (
    <div className="bg-sunken rounded-input flex flex-col gap-0.5 px-3 py-2.5">
      <dt className="text-micro text-ink-faint">{label}</dt>
      <dd className="text-body flex items-center gap-1 font-mono font-semibold">
        {icon !== undefined && <Icon name={icon} filled className="text-gold-deep size-3.5" />}
        {value}
      </dd>
    </div>
  );
}

/**
 * The study streak map: a year of days, one square per day, a column per
 * week, Monday at the top, like a contribution graph. A darker square means
 * more time studied that day. Hover, tap or arrow keys pick a day, and the
 * line under the map says what the learner did on it, so colour is never the
 * only way to read it.
 *
 * On a phone the year does not fit, so the map scrolls sideways inside its
 * card and opens on the latest weeks. The page itself never scrolls sideways.
 *
 * Private: the home page renders it only for the signed-in learner, from
 * their own document.
 */
export function StudyHeatmap({ activity, today: serverToday, className }: StudyHeatmapProps) {
  // The server knows only UTC. The learner's own day decides where the year ends.
  const today = useSyncExternalStore(subscribeNever, localDay, () => serverToday);
  // Null until the learner picks a day: then the line under the map shows today.
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const map = useMemo(() => buildStudyMap(activity, today), [activity, today]);
  const cells = useMemo(() => map.weeks.flatMap((week) => week.days), [map]);
  const byDay = useMemo(() => new Map(cells.map((cell) => [cell.day, cell])), [cells]);
  const current: StudyDay | undefined =
    (selected === null ? undefined : byDay.get(selected)) ?? byDay.get(today);

  useEffect(() => {
    const element = scroller.current;
    if (element !== null) element.scrollLeft = element.scrollWidth;
  }, [today]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, day: string): void => {
    const step = KEY_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = cells.findIndex((cell) => cell.day === day);
    const target = cells[index + step];
    if (target === undefined || target.future) return;
    setSelected(target.day);
    scroller.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${target.day}"]`)
      ?.focus({ preventScroll: false });
  };

  return (
    <section
      aria-labelledby="study-map-heading"
      className={cn(
        'bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-5 border p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="eyebrow text-ink-faint">Study streak</p>
        <h2 id="study-map-heading" className="text-heading">
          {map.activeDays} {map.activeDays === 1 ? 'day' : 'days'} studied in the last year
        </h2>
        <p className="text-small text-ink-soft">
          Time on any course page counts while you use it. Darker squares mean 15 minutes, 30
          minutes, then an hour or more. Only you see this.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Current streak" value={days(map.currentStreak)} icon="flame" />
        <Stat label="Longest streak" value={days(map.longestStreak)} />
        <Stat label="Time this year" value={formatStudyTime(map.totalSeconds)} />
        <Stat label="Today" value={formatStudyTime(activity.seconds[today] ?? 0)} />
      </dl>

      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          role="group"
          aria-label="Study time per day for the last 53 weeks"
          className="flex w-full min-w-max justify-between gap-1"
        >
          <div className="bg-surface sticky left-0 z-1 flex flex-col gap-1 pr-1">
            <span className="h-4" aria-hidden="true" />
            {ROW_LABELS.map((label, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="text-micro text-ink-faint flex h-3 w-7 items-center"
              >
                {label}
              </span>
            ))}
          </div>
          {map.weeks.map((week) => (
            <div key={week.days[0]?.day} className="flex flex-col gap-1">
              <span
                aria-hidden="true"
                className="text-micro text-ink-faint h-4 w-3 overflow-visible whitespace-nowrap"
              >
                {week.month ?? ''}
              </span>
              {week.days.map((cell) =>
                cell.future ? (
                  <span key={cell.day} aria-hidden="true" className="block size-3" />
                ) : (
                  <button
                    key={cell.day}
                    type="button"
                    data-day={cell.day}
                    aria-label={describeStudyDay(cell)}
                    aria-pressed={cell.day === current?.day}
                    tabIndex={cell.day === current?.day ? 0 : -1}
                    title={describeStudyDay(cell)}
                    onClick={() => setSelected(cell.day)}
                    onMouseEnter={() => setSelected(cell.day)}
                    onFocus={() => setSelected(cell.day)}
                    onKeyDown={(event) => onKeyDown(event, cell.day)}
                    className={cn(
                      'rounded-dot focus-visible:outline-ink block size-3 cursor-pointer focus-visible:outline focus-visible:outline-offset-1',
                      HEAT[cell.level],
                      cell.day === current?.day &&
                        'ring-ink ring-offset-surface ring-1 ring-offset-1',
                    )}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-ink-soft min-h-5" aria-live="polite">
          {current === undefined ? '' : describeStudyDay(current)}
        </p>
        <span
          className="text-micro text-ink-faint flex shrink-0 items-center gap-1"
          aria-hidden="true"
        >
          Less
          {HEAT.map((tone) => (
            <span key={tone} className={cn('rounded-dot block size-3', tone)} />
          ))}
          More
        </span>
      </div>
    </section>
  );
}
