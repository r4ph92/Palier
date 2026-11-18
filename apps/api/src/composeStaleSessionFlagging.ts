import type { StaleSessionJob } from './domain/parkingSessions/flagStaleSessions.ts';
import type { Clock } from './domain/time/Clock.ts';
import { SECOND_MILLISECONDS } from './domain/time/seconds.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresStaleSessionRepository } from './infrastructure/postgres/PostgresStaleSessionRepository.ts';

export interface StaleSessionFlaggingComposition {
  readonly job: StaleSessionJob;
  readonly periodMilliseconds: number;
}

export interface StaleSessionFlaggingSettings {
  readonly clock: Clock;
  readonly periodSeconds: number;
}

export function composeStaleSessionFlagging({ clock, periodSeconds }: StaleSessionFlaggingSettings, database: Database): StaleSessionFlaggingComposition {
  return { job: { staleSessions: new PostgresStaleSessionRepository(database), clock }, periodMilliseconds: periodSeconds * SECOND_MILLISECONDS };
}
