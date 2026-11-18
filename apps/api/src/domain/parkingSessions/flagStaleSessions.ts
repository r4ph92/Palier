import type { JobLog } from '../JobLog.ts';
import { logLotFailure } from '../logLotFailure.ts';
import type { Clock } from '../time/Clock.ts';
import { staleCutoff } from './sessionProofs.ts';

export interface StaleCheck {
  readonly cutoff: Date;
  readonly now: Date;
}

// Flagging only writes stale_flagged_at: it never closes a session, captures a payment or frees a spot (Q46, decision 043).
export interface StaleSessionRepository {
  findLotsWithStaleSessions(cutoff: Date): Promise<string[]>;
  flagLotStaleSessions(lotId: string, check: StaleCheck): Promise<number>;
}

interface LotStaleCheck extends StaleCheck {
  readonly lotId: string;
}

export interface StaleSessionJob {
  readonly staleSessions: StaleSessionRepository;
  readonly clock: Clock;
}

// One clock reading per run and one transaction per lot: a lot that cannot be locked waits for the next run, the others still count.
export async function flagStaleSessions({ staleSessions, clock }: StaleSessionJob, log: JobLog): Promise<void> {
  const now = clock();
  const check: StaleCheck = { cutoff: staleCutoff(now), now };
  for (const lotId of await staleSessions.findLotsWithStaleSessions(check.cutoff)) {
    await flagLot(staleSessions, { lotId, ...check }, log);
  }
}

async function flagLot(staleSessions: StaleSessionRepository, { lotId, ...check }: LotStaleCheck, log: JobLog): Promise<void> {
  try {
    const flagged = await staleSessions.flagLotStaleSessions(lotId, check);
    if (flagged > 0) {
      log.info({ lotId, flagged }, 'flagged the sessions with no exit for 7 days for a physical check');
    }
  } catch (error) {
    logLotFailure(log, { lotId, error }, 'could not flag the stale sessions of a lot, retried at the next check');
  }
}
