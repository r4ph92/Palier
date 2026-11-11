import type { PresumptionEvidence } from '../../../src/domain/parkingSessions/PresumptionEvidence.ts';
import type { SilenceCheck, SilentPresumptions, SilentSessionRepository } from '../../../src/domain/parkingSessions/presumeSilentSessions.ts';

export type FakeSilentSession =
  | { readonly state: 'ENTRY_CONFIRMED'; readonly entryConfirmedAt: Date; presumedBy: PresumptionEvidence | null }
  | { readonly state: 'PARKED_UNCONFIRMED'; readonly parkedAt: Date; presumedBy: PresumptionEvidence | null }
  | { readonly state: 'CANCELLED' | 'CREATED'; presumedBy: null };

// Applies the same cut as the SQL (at or before the cutoff); the statements themselves are proven on scripted SQL.
export class FakeSilentSessionRepository implements SilentSessionRepository {
  readonly sessions: FakeSilentSession[] = [];
  readonly presumptions: ({ readonly lotId: string } & SilenceCheck)[] = [];

  findLotsWithSilentSessions(cutoff: Date): Promise<string[]> {
    return Promise.resolve(this.sessions.some((session) => isSilent(session, cutoff)) ? ['lot-demo'] : []);
  }

  presumeLotSilentSessions(lotId: string, silence: SilenceCheck): Promise<SilentPresumptions> {
    this.presumptions.push({ lotId, ...silence });
    const silent = this.sessions.filter((session) => isSilent(session, silence.cutoff));
    for (const session of silent) {
      session.presumedBy = 'TIMEOUT';
    }
    const confirmedEntries = silent.filter(({ state }) => state === 'ENTRY_CONFIRMED').length;
    return Promise.resolve({ confirmedEntries, unansweredQuestions: silent.length - confirmedEntries });
  }
}

function isSilent(session: FakeSilentSession, cutoff: Date): boolean {
  if (session.presumedBy !== null) {
    return false;
  }
  if (session.state === 'ENTRY_CONFIRMED') {
    return session.entryConfirmedAt <= cutoff;
  }
  return session.state === 'PARKED_UNCONFIRMED' && session.parkedAt <= cutoff;
}
