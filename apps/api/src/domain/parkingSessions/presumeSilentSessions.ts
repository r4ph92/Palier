import type { JobLog } from '../JobLog.ts';
import { MILLISECONDS_PER_MINUTE } from '../time/durations.ts';
import type { Clock } from '../time/Clock.ts';

// Q36: a session that sent no signal for this long is presumed parked on its spot; silence never frees a spot.
export const SILENCE_BEFORE_PRESUMPTION_MILLISECONDS = 30 * MILLISECONDS_PER_MINUTE;

export interface SilentPresumptions {
  readonly confirmedEntries: number;
  readonly unansweredQuestions: number;
}

export interface SilenceCheck {
  readonly cutoff: Date;
  readonly now: Date;
}

export interface SilentSessionRepository {
  // Lots with an entry confirmed, or a question asked, at or before the cutoff and still waiting for a signal or an answer.
  findLotsWithSilentSessions(cutoff: Date): Promise<string[]>;
  presumeLotSilentSessions(lotId: string, silence: SilenceCheck): Promise<SilentPresumptions>;
}

export interface SilentSessionJob {
  readonly silentSessions: SilentSessionRepository;
  readonly clock: Clock;
}

// One clock reading per run and one transaction per lot: a lot that cannot be locked waits for the next run, the others still count.
export async function presumeSilentSessions({ silentSessions, clock }: SilentSessionJob, log: JobLog): Promise<void> {
  const now = clock();
  const cutoff = new Date(now.getTime() - SILENCE_BEFORE_PRESUMPTION_MILLISECONDS);
  for (const lotId of await silentSessions.findLotsWithSilentSessions(cutoff)) {
    await presumeLot(silentSessions, { lotId, cutoff, now }, log);
  }
}

async function presumeLot(silentSessions: SilentSessionRepository, { lotId, ...silence }: SilenceCheck & { readonly lotId: string }, log: JobLog): Promise<void> {
  try {
    const { confirmedEntries, unansweredQuestions } = await silentSessions.presumeLotSilentSessions(lotId, silence);
    if (confirmedEntries + unansweredQuestions > 0) {
      log.info({ lotId, confirmedEntries, unansweredQuestions }, 'presumed parked the sessions silent for 30 minutes');
    }
  } catch (error) {
    log.error({ err: error, lotId }, 'could not presume the silent sessions of a lot, retried at the next check');
  }
}
