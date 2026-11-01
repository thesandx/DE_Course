/**
 * The numbers the course hub shows for each course a learner joined: XP, the
 * level line, the streak, how far through the course they are, and the next
 * step. Pure: derived from the learner record and each catalogue.
 */

import { isKnownItem, nextLesson, PROBLEMS, TRACKS } from '@/lib/course/catalog';
import { type CourseSlug } from '@/lib/course/courses';
import { examReadiness, nextStation, stationXp } from '@/lib/course/gcp/catalog';
import { summarizeGcp } from '@/lib/course/gcp/summary';
import { courseRecord, type LearnerRecord, LESSON_XP } from '@/lib/course/progress';
import { summarize } from '@/lib/course/summary';

export interface HubCourseStats {
  course: CourseSlug;
  xp: number;
  levelLine: string;
  streak: number;
  /** 0 to 1. */
  ratio: number;
  /** What `ratio` measures, for the ring's label. */
  ratioLabel: string;
  /** One line on the next step. */
  nextLabel: string;
  nextHref: string;
  /** XP the next step is worth, or null when the course is finished. */
  nextXp: number | null;
}

export function hubStats(record: LearnerRecord, course: CourseSlug, today: string): HubCourseStats {
  const progress = courseRecord(record, course);
  if (course === 'gcp') {
    const summary = summarizeGcp(progress, today);
    const next = nextStation(progress.done);
    return {
      course,
      xp: summary.xp,
      levelLine: `Rank ${summary.rank.number} · ${summary.rank.title}`,
      streak: summary.streak,
      ratio: examReadiness(progress.done),
      ratioLabel: 'Exam readiness',
      nextLabel:
        next === undefined
          ? 'Sit the mock exam'
          : `Station ${next.station.code}: ${next.station.title}`,
      nextHref:
        next === undefined
          ? '/gcp/practice/mock'
          : `/gcp/lines/${next.line.slug}/${next.station.slug}`,
      nextXp: next === undefined ? null : stationXp(next.station),
    };
  }
  const summary = summarize(progress, today);
  const next = nextLesson(progress.done);
  const items = TRACKS.reduce((sum, track) => sum + track.lessons.length, 0) + PROBLEMS.length;
  return {
    course,
    xp: summary.xp,
    levelLine: `Level ${summary.level.number} · ${summary.level.title}`,
    streak: summary.streak,
    ratio: items === 0 ? 0 : Object.keys(progress.done).filter(isKnownItem).length / items,
    ratioLabel: 'Course progress',
    nextLabel: next === undefined ? 'Practise the problems' : `Next lesson: ${next.lesson.title}`,
    nextHref:
      next === undefined ? '/de/problems' : `/de/tracks/${next.track.slug}/${next.lesson.slug}`,
    nextXp: next === undefined ? null : LESSON_XP,
  };
}
