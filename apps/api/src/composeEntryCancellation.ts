import type { PaymentAuthorizer } from './domain/entries/PaymentAuthorizer.ts';
import type { CancellationJob } from './domain/entries/unconfirmedEntryCancellation.ts';
import type { OpeningWindow } from './domain/gates/OpeningWindow.ts';
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
}

export function composeEntryCancellation(
  { openingWindow, cancellationPeriodSeconds }: CancellationSchedule,
  database: Database,
  payments: PaymentAuthorizer | null,
): EntryCancellationComposition {
  return {
    job: { entries: new PostgresUnconfirmedEntryRepository(database), payments, openingWindow },
    periodMilliseconds: cancellationPeriodSeconds * SECOND_MILLISECONDS,
  };
}
