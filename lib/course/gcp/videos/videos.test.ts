import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LINES } from '@/lib/course/gcp/catalog';
import {
  GCP_VIDEOS,
  stationVideo,
  videoCaptionsHref,
  videoObjectPath,
  videoPosterHref,
} from '@/lib/course/gcp/videos';

const STATIONS = LINES.flatMap((line) => line.stations.map((station) => station.slug));

describe('the GCP station videos', () => {
  it('has one video for every station, and no video without a station', () => {
    expect(Object.keys(GCP_VIDEOS).sort()).toEqual([...STATIONS].sort());
  });

  it.each(STATIONS)('%s: the timings are in order and inside the video', (slug) => {
    const video = stationVideo(slug);
    if (video === undefined) throw new Error(`no video for ${slug}`);
    expect(video.station).toBe(slug);
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

  it.each(STATIONS)('%s: every quick check opens before a chapter and has one answer', (slug) => {
    const video = GCP_VIDEOS[slug];
    if (video === undefined) throw new Error(`no video for ${slug}`);
    expect(video.checks.length).toBeGreaterThan(0);
    for (const check of video.checks) {
      expect(check.at).toBeGreaterThan(0);
      expect(check.at).toBeLessThan(video.duration);
      // The video pauses in the silence before a chapter: no sentence starts there.
      const next = video.chapters.find((chapter) => chapter.start > check.at);
      if (next === undefined) throw new Error(`${slug}: a check after the last chapter`);
      expect(next.start - check.at).toBeLessThan(1);
      expect(video.cues.some((cue) => cue.start >= check.at && cue.start < next.start)).toBe(false);
      expect(check.options.length).toBeGreaterThan(1);
      expect(check.answers).toHaveLength(1);
      expect(check.options[check.answers[0] ?? -1]).toBeDefined();
      expect(check.why).not.toBe('');
    }
  });

  it.each(STATIONS)('%s: the poster and the captions are in public/', (slug) => {
    expect(existsSync(join(process.cwd(), 'public', videoPosterHref(slug)))).toBe(true);
    expect(existsSync(join(process.cwd(), 'public', videoCaptionsHref(slug)))).toBe(true);
  });

  it('keeps the MP4 files under one bucket prefix', () => {
    expect(videoObjectPath('data-lake')).toBe('course-videos/gcp/data-lake.mp4');
    expect(stationVideo('no-such-station')).toBeUndefined();
  });
});
