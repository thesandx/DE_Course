/**
 * Which pages take notes, and the stable key each note is stored under.
 *
 * A note belongs to one chapter: a DE lesson, a DE problem, a GCP station or
 * a GCP lab. Its key names the chapter, such as `de:lesson:sql:window-functions`,
 * and is the Firestore document id under the learner's notebook. The server
 * accepts only keys that resolve here, so a learner has at most one note per
 * chapter and the notebook stays bounded by the catalogue.
 *
 * Pure. It imports the whole catalogue, so only server code uses it; client
 * components receive the key and title as props.
 */

import { getLesson, getProblem, getTrack } from '@/lib/course/catalog';
import type { CourseSlug } from '@/lib/course/courses';
import { allStations, getLab } from '@/lib/course/gcp/catalog';

export type NoteKind = 'lesson' | 'problem' | 'station' | 'lab';

export interface NoteTarget {
  key: string;
  course: CourseSlug;
  kind: NoteKind;
  /** The chapter's title. */
  title: string;
  /** Where it sits: the track, the exam domain, or the problem's track. */
  group: string;
  /** The chapter's page. */
  href: string;
}

export const KIND_LABEL: Readonly<Record<NoteKind, string>> = {
  lesson: 'Lesson',
  problem: 'Problem',
  station: 'Station',
  lab: 'Lab',
};

/** A key is short, lower-case and colon-separated. Anything else is refused before a lookup. */
export const NOTE_KEY_PATTERN = /^(de|gcp):(lesson|problem|station|lab)(:[a-z0-9-]{1,80}){1,2}$/;

function stationRef(slug: string) {
  return allStations().find((item) => item.station.slug === slug);
}

/** The chapter a key names, or undefined when it names none. */
export function noteTarget(key: string): NoteTarget | undefined {
  if (!NOTE_KEY_PATTERN.test(key)) return undefined;
  const [course, kind, first = '', second] = key.split(':');

  if (course === 'de' && kind === 'lesson' && second !== undefined) {
    const found = getLesson(first, second);
    if (found === undefined) return undefined;
    return {
      key,
      course: 'de',
      kind: 'lesson',
      title: found.lesson.title,
      group: found.track.title,
      href: `/de/tracks/${first}/${second}`,
    };
  }
  if (course === 'de' && kind === 'problem' && second === undefined) {
    const problem = getProblem(first);
    if (problem === undefined) return undefined;
    return {
      key,
      course: 'de',
      kind: 'problem',
      title: problem.title,
      group: getTrack(problem.track)?.title ?? 'Problems',
      href: `/de/problems/${first}`,
    };
  }
  if (course === 'gcp' && (kind === 'station' || kind === 'lab') && second === undefined) {
    const ref = stationRef(first);
    if (ref === undefined) return undefined;
    if (kind === 'lab') {
      const lab = getLab(first);
      if (lab === undefined) return undefined;
      return {
        key,
        course: 'gcp',
        kind: 'lab',
        title: `Lab ${ref.station.code}: ${lab.title}`,
        group: ref.line.title,
        href: `/gcp/labs/${first}`,
      };
    }
    return {
      key,
      course: 'gcp',
      kind: 'station',
      title: `${ref.station.code} ${ref.station.title}`,
      group: ref.line.title,
      href: `/gcp/lines/${ref.line.slug}/${first}`,
    };
  }
  return undefined;
}

/** The note key for a page path, or undefined for a page without notes. */
export function noteKeyForPath(path: string): string | undefined {
  const segments = (path.split(/[?#]/)[0] ?? '').split('/').filter((segment) => segment !== '');
  const [course, section, first, second] = segments;
  let key: string | undefined;
  if (course === 'de' && section === 'tracks' && first !== undefined && second !== undefined) {
    key = `de:lesson:${first}:${second}`;
  } else if (course === 'de' && section === 'problems' && first !== undefined) {
    key = `de:problem:${first}`;
  } else if (course === 'gcp' && section === 'lines' && second !== undefined && second !== 'boss') {
    key = `gcp:station:${second}`;
  } else if (course === 'gcp' && section === 'labs' && first !== undefined) {
    key = `gcp:lab:${first}`;
  }
  return key !== undefined && noteTarget(key) !== undefined ? key : undefined;
}

/** Key builders for the pages, so a page never spells a key by hand. */
export const noteKeys = {
  lesson: (track: string, lesson: string): string => `de:lesson:${track}:${lesson}`,
  problem: (slug: string): string => `de:problem:${slug}`,
  station: (slug: string): string => `gcp:station:${slug}`,
  lab: (slug: string): string => `gcp:lab:${slug}`,
};
