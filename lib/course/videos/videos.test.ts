import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TRACKS } from '@/lib/course/catalog';
import { LINES } from '@/lib/course/gcp/catalog';
import {
  COURSE_VIDEOS,
  courseVideo,
  videoCaptionsHref,
  videoObjectPath,
  videoPosterHref,
} from '@/lib/course/videos';
import type { VideoCourse } from '@/types/video';

/** Every place that must have a video: each GCP station and each DE track. */
const EXPECTED: Readonly<Record<VideoCourse, readonly string[]>> = {
  gcp: LINES.flatMap((line) => line.stations.map((station) => station.slug)),
  de: TRACKS.map((track) => track.slug),
};

const ALL = (Object.keys(EXPECTED) as VideoCourse[]).flatMap((course) =>
  EXPECTED[course].map((slug) => [course, slug] as const),
);

describe('the course videos', () => {
  it.each(Object.keys(EXPECTED) as VideoCourse[])(
    '%s: one video for every station or track, and no other video',
    (course) => {
      expect(Object.keys(COURSE_VIDEOS[course]).sort()).toEqual([...EXPECTED[course]].sort());
    },
  );

  it.each(ALL)('%s/%s: the timings are in order and inside the video', (course, slug) => {
    const video = courseVideo(course, slug);
    if (video === undefined) throw new Error(`no video for ${course}/${slug}`);
    expect(video.slug).toBe(slug);
    expect(video.duration).toBeGreaterThan(30);

    const starts = video.chapters.map((chapter) => chapter.start);
    expect(starts.length).toBeGreaterThan(2);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(Math.max(...starts)).toBeLessThan(video.duration);

    let end = 0;
    for (const cue of video.cues) {
      expect(cue.start).toBeGreaterThanOrEqual(end);
      expect(cue.end).toBeGreaterThan(cue.start);
      expect(cue.text).not.toBe('');
      end = cue.end;
    }
    expect(end).toBeLessThanOrEqual(video.duration);
  });

  it.each(ALL)(
    '%s/%s: every quick check opens before a chapter and has one answer',
    (course, slug) => {
      const video = courseVideo(course, slug);
      if (video === undefined) throw new Error(`no video for ${course}/${slug}`);
      expect(video.checks.length).toBeGreaterThan(0);
      for (const check of video.checks) {
        expect(check.at).toBeGreaterThan(0);
        expect(check.at).toBeLessThan(video.duration);
        // The video pauses in the silence before a chapter: no sentence starts there.
        const next = video.chapters.find((chapter) => chapter.start > check.at);
        if (next === undefined) throw new Error(`${slug}: a check after the last chapter`);
        expect(next.start - check.at).toBeLessThan(1);
        expect(video.cues.some((cue) => cue.start >= check.at && cue.start < next.start)).toBe(
          false,
        );
        expect(check.options.length).toBeGreaterThan(1);
        expect(check.answers).toHaveLength(1);
        expect(check.options[check.answers[0] ?? -1]).toBeDefined();
        expect(check.why).not.toBe('');
      }
    },
  );

  it.each(ALL)('%s/%s: the poster and the captions are in public/', (course, slug) => {
    expect(existsSync(join(process.cwd(), 'public', videoPosterHref(course, slug)))).toBe(true);
    expect(existsSync(join(process.cwd(), 'public', videoCaptionsHref(course, slug)))).toBe(true);
  });

  it('keeps the MP4 files under one bucket prefix for each course', () => {
    expect(videoObjectPath('gcp', 'data-lake')).toBe('course-videos/gcp/data-lake.mp4');
    expect(videoObjectPath('de', 'sql')).toBe('course-videos/de/sql.mp4');
    expect(courseVideo('gcp', 'no-such-station')).toBeUndefined();
  });
});
