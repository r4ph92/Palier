import { describe, expect, it } from 'vitest';
import { composeEntryCancellation } from '../../src/composeEntryCancellation.ts';
import { openingWindowOf } from '../../src/domain/gates/OpeningWindow.ts';
import type { Database } from '../../src/infrastructure/postgres/database.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';

// The repository only keeps the database: nothing is queried while composing.
const unusedDatabase = {} as Database;

describe('composeEntryCancellation', () => {
  it('turns the configured confirmation seconds into the opening window', () => {
    expect(openingWindowOf(60)).toEqual({ withinMilliseconds: 60_000 });
  });

  it('hands the job the very window it was given, and the period in milliseconds', () => {
    const openingWindow = { withinMilliseconds: 60_000 };

    const composed = composeEntryCancellation({ openingWindow, cancellationPeriodSeconds: 30, clock: () => new Date() }, unusedDatabase, null);

    expect(composed.job.openingWindow).toBe(openingWindow);
    expect(composed.periodMilliseconds).toBe(30_000);
  });

  it('releases holds through the authorizer the entry routes use', () => {
    const payments = new FakePaymentAuthorizer();

    const schedule = { openingWindow: { withinMilliseconds: 45_000 }, cancellationPeriodSeconds: 15, clock: () => new Date() };

    expect(composeEntryCancellation(schedule, unusedDatabase, payments).job.payments).toBe(payments);
  });
});
