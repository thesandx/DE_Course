/**
 * The explainer videos of the courses. The GCP course has one video per
 * station, and the DE course has one video per track. The rules are in
 * `lib/course/README.md` > Explainer videos.
 */

/** The courses that have explainer videos. Also the folder name in the bucket and in `public/`. */
export type VideoCourse = 'gcp' | 'de';

/** A chapter of a video. The player lists the chapters and jumps to one on a tap. */
export interface VideoChapter {
  title: string;
  /** Seconds from the start of the video. */
  start: number;
}

/** One caption: the words the voice says between `start` and `end`, in seconds. */
export interface VideoCue {
  start: number;
  end: number;
  text: string;
}

/**
 * A question that pauses the video when a chapter ends. The options are shown
 * in the order of the file, so `answers` is not always the first option.
 */
export interface VideoCheck {
  /** Seconds from the start of the video. The video pauses here. */
  at: number;
  prompt: string;
  options: readonly string[];
  /** Indexes into `options`. A video check has one. */
  answers: readonly number[];
  /** Why the answer is right. Shown after the learner answers. */
  why: string;
}

/**
 * One explainer video: its length, chapters, captions and quick checks. The
 * picture and the sound are one MP4 file in Cloud Storage;
 * `scripts/course-videos/` builds the file and this data from one script.
 */
export interface CourseVideo {
  /** The station slug (GCP) or the track slug (DE). */
  slug: string;
  /** Seconds. */
  duration: number;
  chapters: readonly VideoChapter[];
  cues: readonly VideoCue[];
  checks: readonly VideoCheck[];
}
