import type { HoldExpiryJob } from './domain/spotHolds/expireSpotHolds.ts';
import type { Clock } from './domain/time/Clock.ts';
import { SECOND_MILLISECONDS } from './domain/time/seconds.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresSpotHoldRepository } from './infrastructure/postgres/PostgresSpotHoldRepository.ts';

export interface HoldExpiryComposition {
  readonly job: HoldExpiryJob;
  readonly periodMilliseconds: number;
}

export interface HoldExpirySchedule {
  readonly clock: Clock;
  readonly periodSeconds: number;
}

export function composeHoldExpiry({ clock, periodSeconds }: HoldExpirySchedule, database: Database): HoldExpiryComposition {
  return { job: { spotHolds: new PostgresSpotHoldRepository(database), clock }, periodMilliseconds: periodSeconds * SECOND_MILLISECONDS };
}
