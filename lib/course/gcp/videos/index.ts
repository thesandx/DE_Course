import { VIDEO_TIMINGS } from '@/lib/course/gcp/videos/timings';
import type { GcpVideo } from '@/types/gcp';

/**
 * The explainer videos of the GCP course: one per station.
 *
 * `timings.ts` is written by `scripts/gcp-videos/collect.py`. Do not edit it
 * by hand: change the station script and build the video again. The rules are
 * in `lib/course/gcp/README.md` > Explainer videos.
 */

/** Every video, keyed by station slug. */
export const GCP_VIDEOS: Readonly<Record<string, GcpVideo>> = VIDEO_TIMINGS;

/** The video of a station, if it has one. */
export function stationVideo(station: string): GcpVideo | undefined {
  return GCP_VIDEOS[station];
}

/**
 * The object path of a station's MP4 file in the app bucket. The file is not
 * in the repository: 19 videos are about 80 MB. See ADR-0013.
 */
export function videoObjectPath(station: string): string {
  return `course-videos/gcp/${station}.mp4`;
}

/** The poster image: one frame of the video, served from `public/`. */
export function videoPosterHref(station: string): string {
  return `/gcp/videos/${station}.jpg`;
}

/** The captions as a WebVTT file, for a full-screen player that draws its own captions. */
export function videoCaptionsHref(station: string): string {
  return `/gcp/videos/${station}.vtt`;
}
