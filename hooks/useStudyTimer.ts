'use client';

import { useEffect } from 'react';

import { localDay } from '@/hooks/useRecordProgress';

/** How often the timer checks whether the learner is studying. */
const TICK_SECONDS = 5;

/** No input for this long means the learner stepped away, so the clock stops. */
const IDLE_SECONDS = 5 * 60;

/** The timer reports once this much time has built up. */
const REPORT_SECONDS = 60;

/** Below this, leaving the page is not worth a request. */
const MIN_REPORT_SECONDS = 5;

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart'];

/**
 * Counts the time a signed-in learner spends on a course page, and reports it
 * to `POST /api/study-time` about once a minute. The clock runs only while the
 * tab is visible and the learner used the page in the last five minutes, so a
 * tab left open overnight does not count. Leaving the page sends the rest with
 * `keepalive`, so the last minute is not lost.
 *
 * The time counts for the learner's local day. Any failure is dropped: a lost
 * minute on a private map is not worth an error message.
 */
export function useStudyTimer(): void {
  useEffect(() => {
    let pending = 0;
    let lastInput = Date.now();

    const send = (seconds: number): void => {
      void fetch('/api/study-time', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seconds, day: localDay() }),
        keepalive: true,
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    };

    const flush = (minimum: number): void => {
      if (pending < minimum) return;
      const seconds = Math.round(pending);
      pending = 0;
      send(seconds);
    };

    const onInput = (): void => {
      lastInput = Date.now();
    };

    const tick = window.setInterval(() => {
      const visible = document.visibilityState === 'visible';
      const recent = Date.now() - lastInput < IDLE_SECONDS * 1000;
      if (visible && recent) pending += TICK_SECONDS;
      flush(REPORT_SECONDS);
    }, TICK_SECONDS * 1000);

    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flush(MIN_REPORT_SECONDS);
      else lastInput = Date.now();
    };
    const onLeave = (): void => flush(MIN_REPORT_SECONDS);

    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onInput, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);

    return () => {
      window.clearInterval(tick);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onInput);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      // A move to another page inside the app unmounts the shell: keep the time.
      flush(MIN_REPORT_SECONDS);
    };
  }, []);
}
