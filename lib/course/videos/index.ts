import { VIDEO_TIMINGS as DE_TIMINGS } from '@/lib/course/videos/de';
import { VIDEO_TIMINGS as GCP_TIMINGS } from '@/lib/course/videos/gcp';
import type { CourseVideo, VideoCourse } from '@/types/video';

/**
 * The explainer videos: one per GCP station and one per DE track.
 *
 * `gcp.ts` and `de.ts` are written by `scripts/course-videos/collect.py`. Do
 * not edit them by hand: change the script of the video and build it again.
 * The rules are in `lib/course/README.md` > Explainer videos.
 */

/** Every video of each course, keyed by station slug or track slug. */
export const COURSE_VIDEOS: Readonly<Record<VideoCourse, Readonly<Record<string, CourseVideo>>>> = {
  gcp: GCP_TIMINGS,
  de: DE_TIMINGS,
};

/** The video of a station or a track, if it has one. */
export function courseVideo(course: VideoCourse, slug: string): CourseVideo | undefined {
  return COURSE_VIDEOS[course][slug];
}

/**
 * The object path of the MP4 file in the app bucket. The file is not in the
 * repository: the videos are about 140 MB. See ADR-0013.
 */
export function videoObjectPath(course: VideoCourse, slug: string): string {
  return `course-videos/${course}/${slug}.mp4`;
}

/** The poster image: one frame of the video, served from `public/`. */
export function videoPosterHref(course: VideoCourse, slug: string): string {
  return `/${course}/videos/${slug}.jpg`;
}

/** The captions as a WebVTT file, for a full-screen player that draws its own captions. */
export function videoCaptionsHref(course: VideoCourse, slug: string): string {
  return `/${course}/videos/${slug}.vtt`;
}
