import type { PaymentAuthorizer } from './domain/entries/PaymentAuthorizer.ts';
import type { CancellationJob } from './domain/entries/unconfirmedEntryCancellation.ts';
import type { OpeningWindow } from './domain/gates/OpeningWindow.ts';
import type { Clock } from './domain/time/Clock.ts';
import { SECOND_MILLISECONDS } from './domain/time/seconds.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresUnconfirmedEntryRepository } from './infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';

export interface EntryCancellationComposition {
  readonly job: CancellationJob;
  readonly periodMilliseconds: number;
}

export interface CancellationSchedule {
  readonly openingWindow: OpeningWindow;
  readonly cancellationPeriodSeconds: number;
  // The clock holds are compared with (decision 016), so the test clock moves the end of a restored hold.
  readonly clock: Clock;
}

export function composeEntryCancellation(
  { openingWindow, cancellationPeriodSeconds, clock }: CancellationSchedule,
  database: Database,
  payments: PaymentAuthorizer | null,
): EntryCancellationComposition {
  return {
    job: { entries: new PostgresUnconfirmedEntryRepository(database, clock), payments, openingWindow },
    periodMilliseconds: cancellationPeriodSeconds * SECOND_MILLISECONDS,
  };
}
