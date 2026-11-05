import type { SpotHold, SpotHoldRefusalCode } from '@palier/shared-types';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import type { SpotHoldClient } from '../api/SpotHoldClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';
import { heldSpotFrom, type HeldSpot } from './heldSpot';

// Refusals with a message of their own; any unknown code reads as "Palier is not responding".
export const SPOT_HOLD_REFUSALS = [
  'PREREQUISITES_MISSING',
  'HOLD_ALREADY_EXISTS',
  'HOLD_QUOTA_REACHED',
  'NO_SUITABLE_SPOT',
  'LOT_NOT_FOUND',
  'LOT_NOT_IN_SERVICE',
  'HOLD_UNAVAILABLE',
  'TOO_MANY_HOLD_ATTEMPTS',
] as const satisfies readonly SpotHoldRefusalCode[];

export type SpotHoldRefusal = (typeof SPOT_HOLD_REFUSALS)[number];

export type SpotHoldFailure =
  | { readonly kind: 'refused'; readonly refusal: SpotHoldRefusal }
  | { readonly kind: 'notResponding' }
  | { readonly kind: 'unreachable' };

export interface SpotHoldController {
  readonly held: HeldSpot | null;
  readonly failure: SpotHoldFailure | null;
  // The lot of the request in flight; every hold button waits while it runs.
  readonly requestedLotId: string | null;
  hold(lotId: string, onHeld: () => void): void;
  acknowledgeFreshHold(): void;
}

interface SpotHoldUpdates {
  readonly setHeld: Dispatch<SetStateAction<HeldSpot | null>>;
  readonly setFailure: Dispatch<SetStateAction<SpotHoldFailure | null>>;
}

// Lives as long as the driver is signed in, above the tabs: the hold read at sign-in or relaunch survives a tab change.
export function useSpotHold(client: SpotHoldClient): SpotHoldController {
  const [held, setHeld] = useState<HeldSpot | null>(null);
  const [failure, setFailure] = useState<SpotHoldFailure | null>(null);
  useEffect(() => void readCurrentHold(client, { setHeld, setFailure }), [client]);
  const { requestedLotId, hold } = useHoldRequest(client, { setHeld, setFailure });
  const acknowledgeFreshHold = useCallback(() => setHeld((previous) => (previous?.isFresh === true ? { ...previous, isFresh: false } : previous)), []);
  return { held, failure, requestedLotId, hold, acknowledgeFreshHold };
}

// The ref refuses a second request while one runs, so a double tap sends one request.
function useHoldRequest(client: SpotHoldClient, { setHeld, setFailure }: SpotHoldUpdates): Pick<SpotHoldController, 'requestedLotId' | 'hold'> {
  const [requestedLotId, setRequestedLotId] = useState<string | null>(null);
  const isRequesting = useRef(false);
  const hold = useCallback(
    (lotId: string, onHeld: () => void) => {
      if (isRequesting.current) {
        return;
      }
      isRequesting.current = true;
      setRequestedLotId(lotId);
      setFailure(null);
      void requestHold(client, lotId, { setHeld, setFailure, onHeld }).finally(() => {
        isRequesting.current = false;
        setRequestedLotId(null);
      });
    },
    [client, setHeld, setFailure],
  );
  return { requestedLotId, hold };
}

// A hold already on screen wins over a read that started before it was taken.
async function readCurrentHold(client: SpotHoldClient, { setHeld, setFailure }: SpotHoldUpdates): Promise<void> {
  try {
    const spotHold = await client.current();
    if (spotHold !== null) {
      setHeld((previous) => previous ?? heldSpotFrom(spotHold, Date.now(), false));
    }
  } catch (error) {
    // Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
    setFailure((previous) => (isExpectedReadFailure(error) ? previous : rethrow(error)));
  }
}

interface HoldRequestUpdates extends SpotHoldUpdates {
  readonly onHeld: () => void;
}

// Told the driver already holds a spot, the app reads that hold back so its banner shows.
async function requestHold(client: SpotHoldClient, lotId: string, updates: HoldRequestUpdates): Promise<void> {
  let spotHold: SpotHold;
  try {
    spotHold = await client.hold(lotId);
  } catch (error) {
    updates.setFailure(() => failureOf(error));
    if (error instanceof PalierRejectedError && error.code === 'HOLD_ALREADY_EXISTS') {
      await readCurrentHold(client, updates);
    }
    return;
  }
  updates.setHeld(heldSpotFrom(spotHold, Date.now(), true));
  updates.onHeld();
}

// A status error is checked before the network error it extends: the API answered, so the connection is fine.
// A refused token or a missing notice already moves the app off the tabs.
function failureOf(error: unknown): SpotHoldFailure | null {
  if (error instanceof PalierRejectedError) {
    return isSpotHoldRefusal(error.code) ? { kind: 'refused', refusal: error.code } : { kind: 'notResponding' };
  }
  if (error instanceof PalierStatusError) {
    return { kind: 'notResponding' };
  }
  if (error instanceof PalierUnreachableError) {
    return { kind: 'unreachable' };
  }
  if (error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError) {
    return null;
  }
  return rethrow(error);
}

// Without network at launch the hold is simply not shown yet: the next request reads it back.
function isExpectedReadFailure(error: unknown): boolean {
  return error instanceof PalierUnreachableError || error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError;
}

function rethrow(error: unknown): never {
  throw error;
}

function isSpotHoldRefusal(code: string): code is SpotHoldRefusal {
  return (SPOT_HOLD_REFUSALS as readonly string[]).includes(code);
}
