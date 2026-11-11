import { describe, expect, it } from 'vitest';

import { PROBLEMS, TRACKS } from '@/lib/course/catalog';
import { getLab } from '@/lib/course/gcp/catalog';
import { allStations } from '@/lib/course/gcp/catalog';
import { noteKeyForPath, noteKeys, noteTarget } from '@/lib/notes/targets';

describe('noteTarget', () => {
  it('resolves a note key for every chapter in both courses', () => {
    const keys = [
      ...TRACKS.flatMap((track) =>
        track.lessons.map((lesson) => noteKeys.lesson(track.slug, lesson.slug)),
      ),
      ...PROBLEMS.map((problem) => noteKeys.problem(problem.slug)),
      ...allStations().map(({ station }) => noteKeys.station(station.slug)),
      ...allStations()
        .filter(({ station }) => getLab(station.slug) !== undefined)
        .map(({ station }) => noteKeys.lab(station.slug)),
    ];
    const missing = keys.filter((key) => noteTarget(key) === undefined);
    expect(missing).toEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives each chapter its page', () => {
    const track = TRACKS[0];
    const lesson = track?.lessons[0];
    if (track === undefined || lesson === undefined) throw new Error('no lessons');
    expect(noteTarget(noteKeys.lesson(track.slug, lesson.slug))).toMatchObject({
      course: 'de',
      kind: 'lesson',
      title: lesson.title,
      group: track.title,
      href: `/de/tracks/${track.slug}/${lesson.slug}`,
    });
  });

  it('refuses keys that name nothing', () => {
    expect(noteTarget('de:lesson:sql:no-such-lesson')).toBeUndefined();
    expect(noteTarget('de:problem:../../etc')).toBeUndefined();
    expect(noteTarget('users/x')).toBeUndefined();
    expect(noteTarget('gcp:lab:nope')).toBeUndefined();
  });
});

describe('noteKeyForPath', () => {
  const station = allStations()[0];

  it('maps each chapter page to its note', () => {
    const track = TRACKS[0];
    const lesson = track?.lessons[0];
    const problem = PROBLEMS[0];
    if (
      track === undefined ||
      lesson === undefined ||
      problem === undefined ||
      station === undefined
    ) {
      throw new Error('empty catalogue');
    }
    expect(noteKeyForPath(`/de/tracks/${track.slug}/${lesson.slug}`)).toBe(
      noteKeys.lesson(track.slug, lesson.slug),
    );
    expect(noteKeyForPath(`/de/problems/${problem.slug}?tab=x`)).toBe(
      noteKeys.problem(problem.slug),
    );
    expect(noteKeyForPath(`/gcp/lines/${station.line.slug}/${station.station.slug}`)).toBe(
      noteKeys.station(station.station.slug),
    );
  });

  it('gives pages without notes no key', () => {
    expect(noteKeyForPath('/de')).toBeUndefined();
    expect(noteKeyForPath('/de/tracks/sql')).toBeUndefined();
    expect(noteKeyForPath(`/gcp/lines/${station?.line.slug ?? 'x'}/boss`)).toBeUndefined();
    expect(noteKeyForPath('/profile')).toBeUndefined();
  });
});
