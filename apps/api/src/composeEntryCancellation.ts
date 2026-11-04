import type { EntryCancellationTiming } from './config/entryCancellationTiming.ts';
import type { PaymentAuthorizer } from './domain/entries/PaymentAuthorizer.ts';
import type { CancellationJob } from './domain/entries/unconfirmedEntryCancellation.ts';
import type { OpeningWindow } from './domain/gates/OpeningWindow.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresUnconfirmedEntryRepository } from './infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';

const SECOND_MILLISECONDS = 1000;

export interface EntryCancellationComposition {
  // Given to the gate routes too: a loop closure and the job judge the window from this one object.
  readonly openingWindow: OpeningWindow;
  readonly job: CancellationJob;
  readonly periodMilliseconds: number;
}

export function composeEntryCancellation(
  timing: EntryCancellationTiming,
  database: Database,
  payments: PaymentAuthorizer | null,
): EntryCancellationComposition {
  const openingWindow: OpeningWindow = { withinMilliseconds: timing.confirmationWindowSeconds * SECOND_MILLISECONDS };
  return {
    openingWindow,
    job: { entries: new PostgresUnconfirmedEntryRepository(database), payments, openingWindow },
    periodMilliseconds: timing.cancellationPeriodSeconds * SECOND_MILLISECONDS,
  };
}
