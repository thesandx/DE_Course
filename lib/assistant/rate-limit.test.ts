// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { RateLimiter } from '@/lib/assistant/rate-limit';

describe('RateLimiter', () => {
  it('allows the limit, then asks the learner to wait until the oldest question ages out', () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.take('a', 0)).toBe(0);
    expect(limiter.take('a', 10_000)).toBe(0);
    expect(limiter.take('a', 20_000)).toBe(40);
    expect(limiter.take('b', 20_000)).toBe(0);
    expect(limiter.take('a', 60_001)).toBe(0);
  });
});
