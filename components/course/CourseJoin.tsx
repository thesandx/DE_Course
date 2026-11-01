import Link from 'next/link';

import { EnrollButton } from '@/components/course/EnrollButton';
import { CourseBadge } from '@/components/layout/CourseBadge';
import { buttonStyles } from '@/components/ui/Button';
import { type CourseInfo, isCourseSlug } from '@/lib/course/courses';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';

export interface CoursePreviewItem {
  title: string;
  detail: string;
  hue: number;
}

export interface CourseJoinProps {
  course: CourseInfo;
  /** What the course holds: its tracks or lines, shown before joining. */
  preview: readonly CoursePreviewItem[];
  previewTitle: string;
}

/**
 * A course's home for a learner who has not joined it: what the course is,
 * what it holds, and one button to join. Joining starts the course's own
 * tracker; nothing from another course carries over.
 */
export function CourseJoin({ course, preview, previewTitle }: CourseJoinProps) {
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
          {isCourseSlug(course.slug) && (
            <EnrollButton
              course={course.slug}
              href={course.href}
              label="Join this course"
              block
              className="sm:w-auto"
            />
          )}
          <Link href="/" className={buttonStyles({ variant: 'night', size: 'lg' })}>
            All courses
          </Link>
        </div>
      </section>

      <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
        <h2 id="preview-heading" className="text-title">
          {previewTitle}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((item, index) => (
            <li
              key={item.title}
              className={cn(
                'bg-surface border-line rounded-card shadow-card flex flex-col gap-1 border border-l-4 p-4',
                hueStyle(item.hue).rail,
              )}
            >
              <span className="text-micro text-ink-faint font-mono">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-body font-semibold">{item.title}</span>
              <span className="text-small text-ink-soft">{item.detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
