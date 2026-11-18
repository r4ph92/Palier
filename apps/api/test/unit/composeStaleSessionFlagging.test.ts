import { describe, expect, it } from 'vitest';
import { composeStaleSessionFlagging } from '../../src/composeStaleSessionFlagging.ts';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import type { Database } from '../../src/infrastructure/postgres/database.ts';

// The repository only keeps the database: nothing is queried while composing.
const unusedDatabase = {} as Database;

describe('composeStaleSessionFlagging', () => {
  it('gives the job the very clock it was given, so the test clock moves the 7 days', () => {
    const testClock = createTestClock();
    testClock.setFixed(new Date('2026-11-08T09:00:00Z'));

    const composed = composeStaleSessionFlagging({ clock: testClock.now, periodSeconds: 3600 }, unusedDatabase);

    expect(composed.job.clock()).toEqual(new Date('2026-11-08T09:00:00Z'));
  });

  it('turns the period into milliseconds', () => {
    expect(composeStaleSessionFlagging({ clock: () => new Date(), periodSeconds: 3600 }, unusedDatabase).periodMilliseconds).toBe(3_600_000);
  });
});
