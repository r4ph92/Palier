import type { EntrySessionState, WalkedAwayState } from '@palier/shared-types';
import { isWalkedAwayState } from '@palier/shared-types/entries';

// Q36: the device saw the driver walk away from the car, which is enough to presume the assigned spot taken.
// detectedAisleMinor: the aisle the device last saw, null when it saw none; another aisle than the spot's asks where the car is.
export interface WalkingSignal {
  readonly sessionId: string;
  readonly driverId: string;
  readonly detectedAt: Date;
  readonly detectedAisleMinor: number | null;
}

// recorded: this signal recorded the walk; already: an earlier signal did, and its state and instant stand.
export type ParkedPresumption =
  | { readonly outcome: 'recorded' | 'already'; readonly state: WalkedAwayState; readonly parkedAt: Date }
  | { readonly outcome: 'not-found' | 'entry-not-confirmed' | 'closed' | 'lot-busy' };

export interface ParkedPresumptionRepository {
  // The driver's own session only: another driver's session is not found, like an unknown id.
  presume(signal: WalkingSignal): Promise<ParkedPresumption>;
}

export interface SessionAfterRefusal {
  readonly state: EntrySessionState;
  readonly parkedAt: Date | null;
}

// Why a walking signal changed nothing. ENTRY_CONFIRMED here means the loop committed after the signal was refused:
// the entry was not confirmed when the signal arrived, so the app has to report a later walk.
export function classifyRefusedSignal(session: SessionAfterRefusal | null): ParkedPresumption {
  if (session === null) {
    return { outcome: 'not-found' };
  }
  if (session.state === 'CANCELLED') {
    return { outcome: 'closed' };
  }
  if (!isWalkedAwayState(session.state)) {
    return { outcome: 'entry-not-confirmed' };
  }
  if (session.parkedAt === null) {
    throw new Error('A session parked after a walk has no parked_at.');
  }
  return { outcome: 'already', state: session.state, parkedAt: session.parkedAt };
}

export interface DetectedAisle {
  readonly id: string;
  readonly code: string;
  readonly beaconMinor: number;
}

export interface WalkAisles {
  readonly assignedAisleId: string;
  // The lot's drivable aisle with the signal's minor; null for no minor, an unknown one or an exit lane.
  readonly detectedAisle: DetectedAisle | null;
}

// The aisle to ask about, or null when the walk presumes the assigned spot: no aisle known, or the spot's own aisle.
export function wrongAisleOf({ assignedAisleId, detectedAisle }: WalkAisles): DetectedAisle | null {
  if (detectedAisle === null || detectedAisle.id === assignedAisleId) {
    return null;
  }
  return detectedAisle;
}
