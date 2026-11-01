import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSetupLimiter } from '../../src/http/SetupLimiter.ts';

const MINUTE = 60 * 1000;

describe('setup limiter', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  it('refuses the attempt after the limit within the window', () => {
    const limiter = createSetupLimiter(2, MINUTE);

    expect([limiter.allow('a'), limiter.allow('a'), limiter.allow('a')]).toEqual([true, true, false]);
  });

  it('counts each key on its own', () => {
    const limiter = createSetupLimiter(1, MINUTE);
    limiter.allow('a');

    expect(limiter.allow('b')).toBe(true);
  });

  it('allows the key again once its attempts leave the window', () => {
    const limiter = createSetupLimiter(1, MINUTE);
    limiter.allow('a');
    vi.setSystemTime(new Date(Date.parse('2026-01-01T00:00:00Z') + MINUTE));

    expect(limiter.allow('a')).toBe(true);
  });
});
