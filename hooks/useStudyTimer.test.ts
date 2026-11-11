import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStudyTimer } from './useStudyTimer';

describe('useStudyTimer', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function reported(): number[] {
    return fetchMock.mock.calls.map(
      ([, init]) => (JSON.parse(String((init as RequestInit).body)) as { seconds: number }).seconds,
    );
  }

  it('reports a minute of use, with the local day', () => {
    renderHook(() => useStudyTimer());
    vi.advanceTimersByTime(60_000);
    expect(reported()).toEqual([60]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/study-time');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toHaveProperty('day');
  });

  it('stops the clock after five minutes with no input', () => {
    renderHook(() => useStudyTimer());
    vi.advanceTimersByTime(10 * 60_000);
    expect(reported().reduce((sum, s) => sum + s, 0)).toBeLessThanOrEqual(5 * 60);
    fetchMock.mockClear();
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(60_000);
    expect(reported()).toEqual([60]);
  });

  it('sends what is left when the page goes away', () => {
    const { unmount } = renderHook(() => useStudyTimer());
    vi.advanceTimersByTime(20_000);
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();
    expect(reported()).toEqual([20]);
  });
});
