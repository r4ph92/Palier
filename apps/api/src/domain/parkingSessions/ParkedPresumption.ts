import type { EntrySessionState } from '@palier/shared-types';

// Q36: the device saw the driver walk away from the car, which is enough to presume the assigned spot taken.
export interface WalkingSignal {
  readonly sessionId: string;
  readonly driverId: string;
  readonly detectedAt: Date;
}

// presumed: this signal recorded the walk; already: an earlier signal did, and its instant stands.
export type ParkedPresumption =
  | { readonly outcome: 'presumed' | 'already'; readonly parkedAt: Date }
  | { readonly outcome: 'not-found' | 'entry-not-confirmed' | 'closed' };

export interface ParkedPresumptionRepository {
  // The driver's own session only: another driver's session is not found, like an unknown id.
  presume(signal: WalkingSignal): Promise<ParkedPresumption>;
}

export interface UnchangedSession {
  readonly state: EntrySessionState;
  readonly parkedAt: Date | null;
}

// Why a walking signal changed nothing. ENTRY_CONFIRMED here means the loop committed after the signal was refused:
// the entry was not confirmed when the signal arrived, and the device sends it again.
export function presumptionOfUnchanged(session: UnchangedSession | null): ParkedPresumption {
  if (session === null) {
    return { outcome: 'not-found' };
  }
  if (session.state === 'CANCELLED') {
    return { outcome: 'closed' };
  }
  if (session.state !== 'PARKED_PRESUMED') {
    return { outcome: 'entry-not-confirmed' };
  }
  if (session.parkedAt === null) {
    throw new Error('A session presumed parked has no parked_at.');
  }
  return { outcome: 'already', parkedAt: session.parkedAt };
}
