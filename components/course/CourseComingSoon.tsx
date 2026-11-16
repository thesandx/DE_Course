import Link from 'next/link';

import { CourseBadge } from '@/components/layout/CourseBadge';
import { buttonStyles } from '@/components/ui/Button';
import type { CourseInfo } from '@/lib/course/courses';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';

export interface CourseComingSoonProps {
  /** A course with `status: 'soon'`. */
  course: CourseInfo;
}

/**
 * The page of a course that is not open yet: what it is, a banner that says
 * it is on the way, and the parts it will hold. It has no join button,
 * because a course that is not open has no tracker to start.
 *
 * The words "Coming soon" are the course's state, not placeholder text. The
 * site checklist allows them in this file only.
 */
export function CourseComingSoon({ course }: CourseComingSoonProps) {
  const plan = course.plan ?? [];
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 md:gap-8 md:px-8 md:py-6">
      <section
        aria-labelledby="course-title"
        className="bg-night-glow rounded-sheet text-on-night shadow-raised flex flex-col gap-5 p-6 md:p-8"
      >
        <div className="flex items-center gap-3">
          <CourseBadge hue={course.hue} short={course.short} size="lg" />
          <p className="eyebrow text-on-night-soft">{course.tagline}</p>
        </div>
        <h1 id="course-title" className="text-display">
          {course.title}
        </h1>
        <p className="text-body text-on-night-soft max-w-2xl">{course.summary}</p>
        <ul className="flex flex-wrap gap-2">
          {course.facts.map((fact) => (
            <li
              key={fact}
              className="border-night-line bg-night-raised rounded-pill text-small border px-3 py-1 font-semibold"
            >
              {fact}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/" className={buttonStyles({ variant: 'night', size: 'lg' })}>
            All courses
          </Link>
        </div>
      </section>

      <section
        role="status"
        aria-labelledby="soon-title"
        className={cn(
          'bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border border-l-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6',
          hueStyle(course.hue).rail,
        )}
      >
        <span
          className={cn(
            'rounded-pill text-ink text-small inline-flex w-fit shrink-0 items-center gap-2 px-3 py-1 font-bold',
            hueStyle(course.hue).fill,
          )}
        >
          <span aria-hidden="true" className="bg-ink size-2 animate-pulse rounded-full" />
          Coming soon
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="soon-title" className="text-heading">
            This course is being written
          </h2>
          <p className="text-body text-ink-soft">
            The lessons, labs and mock exam are not ready yet. It will open here, and on your home
            page, when they are. Your other courses keep their own progress.
          </p>
        </div>
      </section>

      {plan.length > 0 && (
        <section aria-labelledby="plan-heading" className="flex flex-col gap-4">
          <h2 id="plan-heading" className="text-title">
            What it will cover
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.map((part, index) => (
              <li
                key={part}
                className="bg-sunken border-line rounded-card flex flex-col gap-1 border p-4"
              >
                <span className="text-micro text-ink-faint font-mono">
                  Section {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-body text-ink-soft font-semibold">{part}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
