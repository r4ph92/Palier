import type { EntryCancellationTiming } from './config/entryCancellationTiming.ts';
import type { PaymentAuthorizer } from './domain/entries/PaymentAuthorizer.ts';
import type { CancellationJob } from './domain/entries/unconfirmedEntryCancellation.ts';
import type { OpeningWindow } from './domain/gates/OpeningWindow.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresUnconfirmedEntryRepository } from './infrastructure/postgres/PostgresUnconfirmedEntryRepository.ts';

const SECOND_MILLISECONDS = 1000;

export interface EntryCancellationComposition {
  // Given to the gate routes too.
  readonly openingWindow: OpeningWindow;
  readonly job: CancellationJob;
  readonly periodMilliseconds: number;
}

export interface CancellationSchedule {
  readonly openingWindow: OpeningWindow;
  readonly cancellationPeriodSeconds: number;
}

// Built once, before the entries and the job: an entry replay, a loop closure and the job judge the window from this one object.
export function openingWindowOf(timing: EntryCancellationTiming): OpeningWindow {
  return { withinMilliseconds: timing.confirmationWindowSeconds * SECOND_MILLISECONDS };
}

export function composeEntryCancellation(
  { openingWindow, cancellationPeriodSeconds }: CancellationSchedule,
  database: Database,
  payments: PaymentAuthorizer | null,
): EntryCancellationComposition {
  return {
    openingWindow,
    job: { entries: new PostgresUnconfirmedEntryRepository(database), payments, openingWindow },
    periodMilliseconds: cancellationPeriodSeconds * SECOND_MILLISECONDS,
  };
}
