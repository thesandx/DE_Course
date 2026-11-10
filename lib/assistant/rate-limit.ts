/**
 * A per-learner limit on questions to the AI doubt assistant, so one runaway
 * tab or a leaked session cannot spend the OpenRouter credit.
 *
 * In memory, per Cloud Run instance. That is deliberate: the limit is a brake,
 * not an accounting system, and with at most ten instances the worst case is
 * ten times the limit. OpenRouter's own credit limit on the key is the hard cap.
 *
 * Pure: the clock is passed in, so the tests need no timers.
 */

export interface RateLimit {
  /** Questions allowed in one window. */
  limit: number;
  windowMs: number;
}

/** 30 questions in 10 minutes: plenty for study, far below a script. */
export const ASSISTANT_RATE_LIMIT: RateLimit = { limit: 30, windowMs: 10 * 60 * 1000 };

/** The most learners tracked at once. The oldest drops off first. */
const MAX_TRACKED = 5_000;

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly rule: RateLimit) {}

  /** Records a question. Returns the seconds to wait when over the limit, else 0. */
  take(key: string, now: number): number {
    const since = now - this.rule.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > since);
    if (recent.length >= this.rule.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return Math.max(1, Math.ceil((oldest + this.rule.windowMs - now) / 1000));
    }
    recent.push(now);
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_TRACKED) {
      const first = this.hits.keys().next().value;
      if (first !== undefined) this.hits.delete(first);
    }
    return 0;
  }
}
