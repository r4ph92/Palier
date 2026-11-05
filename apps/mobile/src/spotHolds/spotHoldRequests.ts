import type { SpotHold } from '@palier/shared-types';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SpotHoldClient } from '../api/SpotHoldClient';
import { PalierRejectedError } from '../api/VehicleClient';
import { heldSpotFrom, type HeldSpot } from './heldSpot';
import { failureReasonOf, isExpectedReadFailure, type SpotHoldFailure, type SpotHoldFailureTarget } from './spotHoldFailure';

// 'unknown' until Palier has said whether the driver holds a spot: no hold button shows before then.
export type SpotHoldReadState = 'unknown' | 'settled';

export interface SpotHoldUpdates {
  readonly setHeld: Dispatch<SetStateAction<HeldSpot | null>>;
  readonly setReadState: Dispatch<SetStateAction<SpotHoldReadState>>;
  readonly setFailure: Dispatch<SetStateAction<SpotHoldFailure | null>>;
  // Counts the holds taken or released here: a read that started before one answers too late to be shown.
  readonly holdChanges: RefObject<number>;
  readonly isReading: RefObject<boolean>;
}

// True when Palier answered.
export async function readCurrentHold(client: SpotHoldClient, updates: SpotHoldUpdates): Promise<boolean> {
  let isAnswered = false;
  const holdChangesBefore = updates.holdChanges.current;
  updates.isReading.current = true;
  try {
    const spotHold = await client.current();
    if (updates.holdChanges.current === holdChangesBefore) {
      updates.setHeld((previous) => heldSpotAfterRead(previous, spotHold));
    }
    updates.setReadState('settled');
    isAnswered = true;
  } catch (error) {
    rethrowUnexpectedReadFailure(error, updates);
  } finally {
    updates.isReading.current = false;
  }
  return isAnswered;
}

// Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
function rethrowUnexpectedReadFailure(error: unknown, updates: SpotHoldUpdates): void {
  updates.setFailure((previous) => {
    if (isExpectedReadFailure(error)) {
      return previous;
    }
    throw error;
  });
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

export async function requestHold(client: SpotHoldClient, lotId: string, updates: HoldRequestUpdates): Promise<void> {
  let spotHold: SpotHold;
  try {
    spotHold = await client.hold(lotId);
  } catch (error) {
    updates.setFailure(() => freshFailureOf(error, { kind: 'lot', lotId }));
    if (error instanceof PalierRejectedError && error.code === 'HOLD_ALREADY_EXISTS') {
      await readCurrentHold(client, updates);
    }
    return;
  }
  updates.holdChanges.current += 1;
  updates.setHeld(heldSpotFrom(spotHold, Date.now(), true));
  updates.onHeld();
}

export interface ReleaseCallbacks {
  readonly onReleased: () => void;
  // The hold was already gone and the lots may show it: they are read again.
  readonly onGone: () => void;
}

export async function releaseHold(client: SpotHoldClient, spotHoldId: string, updates: SpotHoldUpdates & ReleaseCallbacks): Promise<void> {
  updates.setFailure(null);
  try {
    await client.release(spotHoldId);
  } catch (error) {
    await showReleaseFailure(client, error, updates);
    return;
  }
  updates.holdChanges.current += 1;
  updates.setHeld(null);
  updates.onReleased();
}

// Released on another device first: the hold is read again and the banner goes. Without an answer the banner would stay, so the driver is told.
async function showReleaseFailure(client: SpotHoldClient, error: unknown, updates: SpotHoldUpdates & ReleaseCallbacks): Promise<void> {
  const isGone = error instanceof PalierRejectedError && error.code === 'HOLD_NOT_FOUND';
  if (isGone && (await readCurrentHold(client, updates))) {
    updates.onGone();
    return;
  }
  updates.setFailure(() => freshFailureOf(error, { kind: 'heldSpot' }));
}

function freshFailureOf(error: unknown, target: SpotHoldFailureTarget): SpotHoldFailure | null {
  const reason = failureReasonOf(error);
  return reason === null ? null : { target, reason, isFresh: true };
}
