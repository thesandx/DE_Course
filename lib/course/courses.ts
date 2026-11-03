/**
 * The course list: every course on the platform, open or opening later.
 *
 * This file is metadata only. It imports no catalogue, so the tab bar and
 * other client components can read it without shipping the lessons to the
 * browser. The per-course rules (which item ids exist, what each is worth)
 * live in `lib/course/rules.ts`.
 *
 * To add a course: add its slug to `COURSE_SLUGS`, add an entry to
 * `COURSES`, give it rules in `rules.ts` and pages under `app/<slug>/`.
 * A course with `status: 'soon'` shows on the hub but cannot be joined, so
 * it needs only the entry here.
 */

/** The courses a learner can enroll in. Each one keeps its own tracker. */
export const COURSE_SLUGS = ['de', 'gcp'] as const;

export type CourseSlug = (typeof COURSE_SLUGS)[number];

export interface CourseSection {
  href: string;
  label: string;
}

export interface CourseInfo {
  slug: string;
  /** The full name, for headings. */
  title: string;
  /** Two to four characters, for badges and the tab bar. */
  short: string;
  /** One line under the title. */
  tagline: string;
  /** Two sentences for the course card. */
  summary: string;
  status: 'open' | 'soon';
  /** Which `--color-track-*` hue the course card uses. */
  hue: number;
  /** The course dashboard. */
  href: string;
  /** Where the learning content starts: tracks, or the line map. */
  learn: CourseSection;
  /** Where the practice lives: problems, or the drills. */
  practice: CourseSection;
  /** Short facts for the card, such as "51 lessons". */
  facts: readonly string[];
}

export const COURSES: readonly CourseInfo[] = [
  {
    slug: 'de',
    title: 'Senior Data Engineering',
    short: 'DE',
    tagline: 'Senior and staff DE interview loops',
    summary:
      'SQL, Spark, dbt, streaming, modeling and system design, taught for the interview. Lessons, 90 interview problems and loop guides for Uber and Google.',
    status: 'open',
    hue: 2,
    href: '/de',
    learn: { href: '/de/tracks', label: 'Tracks' },
    practice: { href: '/de/problems', label: 'Problems' },
    facts: ['13 tracks', '63 lessons', '90 problems'],
  },
  {
    slug: 'gcp',
    title: 'GCP Professional Data Engineer',
    short: 'GCP',
    tagline: 'Exam prep as a metro map',
    summary:
      'Five exam domains as five metro lines. Ride each station, beat the boss round at the end of the line, then sit the mock exam.',
    status: 'open',
    hue: 5,
    href: '/gcp',
    learn: { href: '/gcp/lines', label: 'Lines' },
    practice: { href: '/gcp/practice', label: 'Drills' },
    facts: ['5 lines', '19 stations', '139 exam questions'],
  },
  {
    slug: 'k8s',
    title: 'Kubernetes for Data Engineers',
    short: 'K8s',
    tagline: 'Run data platforms on Kubernetes',
    summary:
      'Pods, operators, Spark and Airflow on Kubernetes, and the debugging drills a platform interview asks for.',
    status: 'soon',
    hue: 3,
    href: '/k8s',
    learn: { href: '/k8s', label: 'Learn' },
    practice: { href: '/k8s', label: 'Practice' },
    facts: ['Spark on Kubernetes', 'Operators', 'Debugging drills'],
  },
];

export function isCourseSlug(value: string): value is CourseSlug {
  return (COURSE_SLUGS as readonly string[]).includes(value);
}

export function getCourse(slug: CourseSlug): CourseInfo {
  const course = COURSES.find((item) => item.slug === slug);
  if (course === undefined) throw new Error(`Course ${slug} has no entry in COURSES`);
  return course;
}

/** The open course a path sits in, such as `gcp` for `/gcp/lines/design`. */
export function courseFromPath(pathname: string): CourseSlug | undefined {
  const first = pathname.split('/')[1] ?? '';
  return isCourseSlug(first) ? first : undefined;
}
