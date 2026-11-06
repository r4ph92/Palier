import type { SilentSessionJob } from './domain/parkingSessions/presumeSilentSessions.ts';
import type { Clock } from './domain/time/Clock.ts';
import { SECOND_MILLISECONDS } from './domain/time/seconds.ts';
import type { Database } from './infrastructure/postgres/database.ts';
import { PostgresSilentSessionRepository } from './infrastructure/postgres/PostgresSilentSessionRepository.ts';

export interface SilentSessionPresumptionComposition {
  readonly job: SilentSessionJob;
  readonly periodMilliseconds: number;
}

export interface SilentSessionPresumptionSettings {
  readonly clock: Clock;
  readonly periodSeconds: number;
}

export function composeSilentSessionPresumption(
  { clock, periodSeconds }: SilentSessionPresumptionSettings,
  database: Database,
): SilentSessionPresumptionComposition {
  return { job: { silentSessions: new PostgresSilentSessionRepository(database), clock }, periodMilliseconds: periodSeconds * SECOND_MILLISECONDS };
}
