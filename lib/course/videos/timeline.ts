import type { VideoChapter, VideoCheck, VideoCue } from '@/types/video';

/**
 * The pure parts of the video player: which caption, chapter and quick
 * check belong to a moment of the video. The player keeps the state; these
 * functions only read the data.
 */

/** A playback gap longer than this is a seek, not normal playback. In seconds. */
const SEEK_GAP = 2;

/** "1:05" for 65 seconds. The player shows it next to the bar and in the chapter list. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The caption on screen at `time`, if the voice says something then. */
export function cueAt(cues: readonly VideoCue[], time: number): VideoCue | undefined {
  return cues.find((cue) => time >= cue.start && time < cue.end);
}

/** The index of the chapter that plays at `time`. The first chapter covers the lead-in. */
export function chapterAt(chapters: readonly VideoChapter[], time: number): number {
  let current = 0;
  chapters.forEach((chapter, index) => {
    if (time >= chapter.start) current = index;
  });
  return current;
}

/**
 * The index of the quick check that playback just reached, or -1.
 *
 * A check fires only when playback moves across it. A jump along the bar does
 * not fire the checks it passes, because the learner chose to skip that part.
 * `settled` holds the indexes the learner already answered or skipped.
 */
export function checkReached(
  checks: readonly VideoCheck[],
  previous: number,
  now: number,
  settled: ReadonlySet<number>,
): number {
  if (now <= previous || now - previous > SEEK_GAP) return -1;
  return checks.findIndex(
    (check, index) => !settled.has(index) && previous < check.at && now >= check.at,
  );
}
