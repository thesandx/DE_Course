import Link from 'next/link';

import { EnrollButton } from '@/components/course/EnrollButton';
import { ProgressRing } from '@/components/course/ProgressRing';
import { StudyHeatmap } from '@/components/course/StudyHeatmap';
import { CourseBadge } from '@/components/layout/CourseBadge';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { type CourseInfo, COURSES, isCourseSlug } from '@/lib/course/courses';
import type { HubCourseStats } from '@/lib/course/hub';
import { hueStyle } from '@/lib/course/hue';
import type { StudyActivity } from '@/lib/course/study-time';
import { cn } from '@/lib/utils';

export interface CourseHubProps {
  name: string;
  /** Stats for each course the learner joined, in course order. */
  joined: readonly HubCourseStats[];
  /** The learner's own study time and finished items per day, for the streak map. */
  activity: StudyActivity;
  /** `YYYY-MM-DD`. */
  today: string;
}

/** A joined course: its own tracker in one card, with the next step one tap away. */
function JoinedCard({ course, stats }: { course: CourseInfo; stats: HubCourseStats }) {
  const percent = Math.round(stats.ratio * 100);
  return (
    <article
      className={cn(
        'bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border border-t-4 p-5 sm:p-6',
        hueStyle(course.hue).edge,
      )}
    >
      <div className="flex items-start gap-4">
        <CourseBadge hue={course.hue} short={course.short} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="eyebrow text-ink-faint">{stats.levelLine}</p>
          <h3 className="text-heading">
            <Link href={course.href} className="hover:underline">
              {course.title}
            </Link>
          </h3>
          <p className="text-small text-ink-soft">{course.tagline}</p>
        </div>
        <ProgressRing ratio={stats.ratio} label={stats.ratioLabel} size={64} thickness={7}>
          <span className="text-small font-semibold">{percent}%</span>
        </ProgressRing>
      </div>

      <dl className="bg-sunken rounded-input grid grid-cols-3 gap-2 p-3 text-center">
        <div>
          <dt className="text-micro text-ink-faint">XP</dt>
          <dd className="text-body font-mono font-semibold">{stats.xp}</dd>
        </div>
        <div>
          <dt className="text-micro text-ink-faint">Streak</dt>
          <dd className="text-body flex items-center justify-center gap-1 font-mono font-semibold">
            <Icon name="flame" filled className="text-gold-deep size-3.5" />
            {stats.streak}
          </dd>
        </div>
        <div>
          <dt className="text-micro text-ink-faint">{stats.ratioLabel.split(' ')[0]}</dt>
          <dd className="text-body font-mono font-semibold">{percent}%</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-ink-soft min-w-0">
          <span className="text-ink font-semibold">Up next · </span>
          {stats.nextLabel}
          {stats.nextXp !== null && (
            <span className="text-iris font-semibold"> · +{stats.nextXp} XP</span>
          )}
        </p>
        <Link href={stats.nextHref} className={buttonStyles({ size: 'sm', className: 'shrink-0' })}>
          Continue
          <Icon name="arrow-right" className="size-4" />
        </Link>
      </div>
    </article>
  );
}

/** A course the learner has not joined: what it is, and the button to join. */
function OpenCard({ course, primary }: { course: CourseInfo; primary: boolean }) {
  const soon = course.status === 'soon';
  return (
    <article
      className={cn(
        'border-line rounded-card flex w-full flex-col gap-4 border p-5 sm:p-6',
        soon ? 'bg-sunken' : 'bg-surface shadow-card',
      )}
    >
      <div className="flex items-center gap-3">
        <CourseBadge hue={course.hue} short={course.short} size="lg" muted={soon} />
        <div className="flex min-w-0 flex-col">
          <h3 className="text-heading">{course.title}</h3>
          <p className="text-small text-ink-soft">{course.tagline}</p>
        </div>
      </div>
      <p className="text-body text-ink-soft">{course.summary}</p>
      <ul className="flex flex-wrap gap-2">
        {course.facts.map((fact) => (
          <li
            key={fact}
            className="border-line bg-surface rounded-pill text-small border px-2.5 py-0.5 font-medium"
          >
            {fact}
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        {soon || !isCourseSlug(course.slug) ? (
          <p className="text-small text-ink-faint font-semibold">Opening later</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <EnrollButton
              course={course.slug}
              href={course.href}
              variant={primary ? 'primary' : 'secondary'}
              block
              className="sm:w-auto"
            />
            <Link href={course.href} className={buttonStyles({ variant: 'quiet', size: 'sm' })}>
              See what is inside
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * The signed-in home: every course on the platform. Courses the learner
 * joined come first, each with its own tracker (XP, level, streak, progress
 * and the next step). Courses they have not joined follow, with a "Join"
 * button. Courses that are not open yet show as "Opening later".
 */
export function CourseHub({ name, joined, activity, today }: CourseHubProps) {
  const firstName = name.split(' ')[0] ?? name;
  const joinedSlugs = new Set<string>(joined.map((stats) => stats.course));
  const others = COURSES.filter((course) => !joinedSlugs.has(course.slug));
  const totalXp = joined.reduce((sum, stats) => sum + stats.xp, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 md:gap-8 md:px-8 md:py-6">
      <section
        aria-labelledby="greeting"
        className="bg-night-glow rounded-sheet text-on-night shadow-raised flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8"
      >
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-on-night-soft">My learning</p>
          <h1 id="greeting" className="text-display">
            Hi, {firstName}
          </h1>
          <p className="text-body text-on-night-soft max-w-lg">
            {joined.length === 0
              ? 'Pick a course to start. Each course keeps its own XP, streak and progress, so you can run two at once.'
              : `You are in ${joined.length} ${joined.length === 1 ? 'course' : 'courses'}. Each one keeps its own tracker.`}
          </p>
        </div>
        {joined.length > 0 && (
          <dl className="border-night-line flex gap-6 border-t pt-4 md:border-t-0 md:pt-0">
            <div>
              <dt className="text-small text-on-night-soft">Courses</dt>
              <dd className="text-title font-mono">{joined.length}</dd>
            </div>
            <div>
              <dt className="text-small text-on-night-soft">Total XP</dt>
              <dd className="text-title font-mono">{totalXp}</dd>
            </div>
          </dl>
        )}
      </section>

      {joined.length > 0 && <StudyHeatmap activity={activity} today={today} />}

      {joined.length > 0 && (
        <section aria-labelledby="joined-heading" className="flex flex-col gap-4">
          <h2 id="joined-heading" className="text-title">
            Your courses
          </h2>
          <ul className="grid gap-4 lg:grid-cols-2">
            {joined.map((stats) => {
              const course = COURSES.find((item) => item.slug === stats.course);
              return course === undefined ? null : (
                <li key={stats.course}>
                  <JoinedCard course={course} stats={stats} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="explore-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="explore-heading" className="text-title">
              {joined.length === 0 ? 'Choose a course' : 'More courses'}
            </h2>
            <p className="text-body text-ink-soft">
              Joining is free and starts a fresh tracker for that course.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {others.map((course, index) => (
              <li key={course.slug} className="flex">
                <OpenCard course={course} primary={joined.length === 0 && index === 0} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
