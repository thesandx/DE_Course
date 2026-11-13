// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const exists = vi.fn<() => Promise<[boolean]>>();
const getSignedUrl = vi.fn<(options: { expires: number }) => Promise<[string]>>();

vi.mock('@/services/storage.client', () => ({
  getBucket: () => ({ file: () => ({ exists, getSignedUrl }) }),
}));

const { getStationVideoUrl, resetVideoLookups, VIDEO_URL_TTL_MS } =
  await import('@/services/course-video.service');

const STATION = 'security-compliance';
const NOW = Date.parse('2026-11-13T10:00:00.000Z');

describe('getStationVideoUrl', () => {
  beforeEach(() => {
    resetVideoLookups();
    exists.mockReset().mockResolvedValue([true]);
    getSignedUrl.mockReset().mockResolvedValue(['https://storage.example/signed']);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('signs a read URL that lasts long enough to watch the video', async () => {
    const before = Date.now();
    await expect(getStationVideoUrl(STATION, NOW)).resolves.toBe('https://storage.example/signed');
    const expires = getSignedUrl.mock.calls[0]?.[0].expires ?? 0;
    expect(expires).toBeGreaterThanOrEqual(before + VIDEO_URL_TTL_MS);
  });

  it('gives null for a station with no video, and does not ask the bucket', async () => {
    await expect(getStationVideoUrl('no-such-station', NOW)).resolves.toBeNull();
    expect(exists).not.toHaveBeenCalled();
  });

  it('gives null while the file is not in the bucket', async () => {
    exists.mockResolvedValue([false]);
    await expect(getStationVideoUrl(STATION, NOW)).resolves.toBeNull();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('asks the bucket once, then remembers the answer for a while', async () => {
    await getStationVideoUrl(STATION, NOW);
    await getStationVideoUrl(STATION, NOW + 60_000);
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it('looks again soon after a miss, so an upload shows up', async () => {
    exists.mockResolvedValueOnce([false]);
    await expect(getStationVideoUrl(STATION, NOW)).resolves.toBeNull();
    await expect(getStationVideoUrl(STATION, NOW + 61_000)).resolves.not.toBeNull();
  });

  it('gives null when no bucket can be reached', async () => {
    exists.mockRejectedValue(new Error('GCP_PROJECT_ID is not set'));
    await expect(getStationVideoUrl(STATION, NOW)).resolves.toBeNull();
  });

  it('gives null when signing fails', async () => {
    getSignedUrl.mockRejectedValue(new Error('signBlob denied'));
    await expect(getStationVideoUrl(STATION, NOW)).resolves.toBeNull();
  });
});
