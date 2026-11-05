import { describe, expect, it } from 'vitest';
import { composeHoldExpiry } from '../../src/composeHoldExpiry.ts';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import type { Database } from '../../src/infrastructure/postgres/database.ts';

// The repository only keeps the database: nothing is queried while composing.
const unusedDatabase = {} as Database;

describe('composeHoldExpiry', () => {
  it('gives the job the very clock it was given, so the test clock moves the expiry', () => {
    const testClock = createTestClock();
    testClock.setFixed(new Date('2026-11-04T19:17:00Z'));

    const composed = composeHoldExpiry({ clock: testClock.now, periodSeconds: 30 }, unusedDatabase);

    expect(composed.job.clock()).toEqual(new Date('2026-11-04T19:17:00Z'));
  });

  it('turns the period into milliseconds', () => {
    expect(composeHoldExpiry({ clock: () => new Date(), periodSeconds: 30 }, unusedDatabase).periodMilliseconds).toBe(30_000);
  });
});
