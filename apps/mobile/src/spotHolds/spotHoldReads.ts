import type { SpotHold } from '@palier/shared-types';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SpotHoldClient } from '../api/SpotHoldClient';
import { PalierRejectedError } from '../api/VehicleClient';
import { heldSpotFrom, type HeldSpot } from './heldSpot';
import { failureReasonOf, isExpectedReadFailure, type SpotHoldFailure } from './spotHoldFailure';

// 'unknown' until Palier has said whether the driver holds a spot: no hold button shows before then.
export type SpotHoldReadState = 'unknown' | 'settled';

export interface SpotHoldUpdates {
  readonly setHeld: Dispatch<SetStateAction<HeldSpot | null>>;
  readonly setReadState: Dispatch<SetStateAction<SpotHoldReadState>>;
  readonly setFailure: Dispatch<SetStateAction<SpotHoldFailure | null>>;
  // Counts the holds taken here: a read that started before one was taken answers too late to be shown.
  readonly holdsTaken: RefObject<number>;
  readonly isReading: RefObject<boolean>;
}

export async function readCurrentHold(client: SpotHoldClient, updates: SpotHoldUpdates): Promise<void> {
  const holdsTakenBefore = updates.holdsTaken.current;
  updates.isReading.current = true;
  try {
    const spotHold = await client.current();
    if (updates.holdsTaken.current === holdsTakenBefore) {
      updates.setHeld((previous) => heldSpotAfterRead(previous, spotHold));
    }
    updates.setReadState('settled');
  } catch (error) {
    // Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
    updates.setFailure((previous) => {
      if (isExpectedReadFailure(error)) {
        return previous;
      }
      throw error;
    });
  } finally {
    updates.isReading.current = false;
  }
}

// The hold already on screen stays as it is, so a fresh hold still moves VoiceOver to its banner.
function heldSpotAfterRead(previous: HeldSpot | null, spotHold: SpotHold | null): HeldSpot | null {
  if (spotHold === null) {
    return null;
  }
  return previous?.spotHold.spotHoldId === spotHold.spotHoldId ? previous : heldSpotFrom(spotHold, Date.now(), false);
}

interface HoldRequestUpdates extends SpotHoldUpdates {
  readonly onHeld: () => void;
}

// Told the driver already holds a spot, the app reads that hold back so its banner shows.
export async function requestHold(client: SpotHoldClient, lotId: string, updates: HoldRequestUpdates): Promise<void> {
  let spotHold: SpotHold;
  try {
    spotHold = await client.hold(lotId);
  } catch (error) {
    updates.setFailure(() => freshFailureOf(error, lotId));
    if (error instanceof PalierRejectedError && error.code === 'HOLD_ALREADY_EXISTS') {
      await readCurrentHold(client, updates);
    }
    return;
  }
  updates.holdsTaken.current += 1;
  updates.setHeld(heldSpotFrom(spotHold, Date.now(), true));
  updates.setReadState('settled');
  updates.onHeld();
}

function freshFailureOf(error: unknown, lotId: string): SpotHoldFailure | null {
  const reason = failureReasonOf(error);
  return reason === null ? null : { lotId, reason, isFresh: true };
}
