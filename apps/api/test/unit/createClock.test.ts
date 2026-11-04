import { describe, expect, it } from 'vitest';
import { createClock } from '../../src/config/createClock.ts';

describe('createClock', () => {
  it('gives production a real-time clock with no test clock to move', () => {
    const clock = createClock(false);

    expect(clock.testClock).toBeUndefined();
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('gives test environments a clock that reads the instant a tester set', () => {
    const clock = createClock(true);
    const nineFifteen = new Date(2026, 10, 4, 21, 17);

    clock.testClock?.setFixed(nineFifteen);

    expect(clock.now()).toEqual(nineFifteen);
  });
});
