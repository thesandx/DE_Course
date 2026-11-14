import 'server-only';

import { courseVideo, videoObjectPath } from '@/lib/course/videos';
import { logger } from '@/lib/logger';
import { getBucket } from '@/services/storage.client';
import { createSignedReadUrl } from '@/services/storage.service';
import type { VideoCourse } from '@/types/video';

/**
 * Course explainer videos, read from the app bucket.
 *
 * The MP4 files live in Cloud Storage at `course-videos/<course>/<slug>.mp4`,
 * not in the repository and not in the container image: the files are about
 * 140 MB. The bucket is private, so the page gets a signed URL for each view
 * and the browser streams the file straight from Google. See ADR-0013.
 *
 * A station page must never fail because of its video. Every failure here
 * (no bucket configured, the file not uploaded yet, signing refused) gives
 * `null`, and the page leaves the player out.
 */

/**
 * Long enough to watch, pause, do the quick checks and come back. A URL that
 * expires in the middle of a video stops the stream at the next seek.
 */
export const VIDEO_URL_TTL_MS = 6 * 60 * 60 * 1000;

/** A file that exists stays there, so ask the bucket again only now and then. */
const FOUND_FOR_MS = 10 * 60 * 1000;

/** A missing file can arrive at any time, so ask again soon. */
const MISSING_FOR_MS = 60 * 1000;

const seen = new Map<string, { exists: boolean; until: number }>();

async function videoExists(path: string, now: number): Promise<boolean> {
  const cached = seen.get(path);
  if (cached !== undefined && cached.until > now) return cached.exists;

  let exists = false;
  try {
    [exists] = await getBucket().file(path).exists();
  } catch (error) {
    // Local development and CI have no bucket. That is a normal state, not an
    // incident, so it is a warning, and it is remembered like a missing file.
    logger.warn('Could not look for a course video', {
      path,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  seen.set(path, { exists, until: now + (exists ? FOUND_FOR_MS : MISSING_FOR_MS) });
  return exists;
}

/**
 * A signed URL for the video of a GCP station or a DE track, or `null` when it
 * has no video the browser can play.
 *
 * @param course The course of the video.
 * @param slug   The station slug or the track slug.
 * @param now    The clock, in milliseconds. A test passes its own.
 */
export async function getCourseVideoUrl(
  course: VideoCourse,
  slug: string,
  now: number = Date.now(),
): Promise<string | null> {
  if (courseVideo(course, slug) === undefined) return null;

  const path = videoObjectPath(course, slug);
  if (!(await videoExists(path, now))) return null;

  try {
    return await createSignedReadUrl(path, VIDEO_URL_TTL_MS);
  } catch {
    // `createSignedReadUrl` already logged the cause.
    return null;
  }
}

/** Forgets what the bucket said. For tests. */
export function resetVideoLookups(): void {
  seen.clear();
}
