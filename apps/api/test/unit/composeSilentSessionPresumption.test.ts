import { describe, expect, it } from 'vitest';
import { composeSilentSessionPresumption } from '../../src/composeSilentSessionPresumption.ts';
import { createTestClock } from '../../src/domain/time/TestClock.ts';
import type { Database } from '../../src/infrastructure/postgres/database.ts';

// The repository only keeps the database: nothing is queried while composing.
const unusedDatabase = {} as Database;

describe('composeSilentSessionPresumption', () => {
  it('gives the job the very clock it was given, so the test clock moves the 30 minutes', () => {
    const testClock = createTestClock();
    testClock.setFixed(new Date('2026-11-04T19:30:00Z'));

    const composed = composeSilentSessionPresumption({ clock: testClock.now, periodSeconds: 300 }, unusedDatabase);

    expect(composed.job.clock()).toEqual(new Date('2026-11-04T19:30:00Z'));
  });

  it('turns the period into milliseconds', () => {
    expect(composeSilentSessionPresumption({ clock: () => new Date(), periodSeconds: 300 }, unusedDatabase).periodMilliseconds).toBe(300_000);
  });
});
