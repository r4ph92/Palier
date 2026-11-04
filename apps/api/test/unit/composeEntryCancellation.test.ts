import { describe, expect, it } from 'vitest';
import { composeEntryCancellation } from '../../src/composeEntryCancellation.ts';
import type { Database } from '../../src/infrastructure/postgres/database.ts';
import { FakePaymentAuthorizer } from './fakes/entryFakes.ts';

// The repository only keeps the database: nothing is queried while composing.
const unusedDatabase = {} as Database;

describe('composeEntryCancellation', () => {
  it('hands the gate routes and the job the very same window, from the configured seconds', () => {
    const composed = composeEntryCancellation({ confirmationWindowSeconds: 60, cancellationPeriodSeconds: 30 }, unusedDatabase, null);

    expect(composed.openingWindow).toEqual({ withinMilliseconds: 60_000 });
    expect(composed.job.openingWindow).toBe(composed.openingWindow);
    expect(composed.periodMilliseconds).toBe(30_000);
  });

  it('releases holds through the authorizer the entry routes use', () => {
    const payments = new FakePaymentAuthorizer();

    expect(composeEntryCancellation({ confirmationWindowSeconds: 45, cancellationPeriodSeconds: 15 }, unusedDatabase, payments).job.payments).toBe(payments);
  });
});
