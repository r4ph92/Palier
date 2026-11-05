import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpotHoldClient } from '../api/SpotHoldClient';
import type { HeldSpot } from './heldSpot';
import type { SpotHoldFailure } from './spotHoldFailure';
import { readCurrentHold, requestHold, type SpotHoldReadState, type SpotHoldUpdates } from './spotHoldReads';

export interface SpotHoldController {
  readonly held: HeldSpot | null;
  readonly readState: SpotHoldReadState;
  readonly failure: SpotHoldFailure | null;
  // The lot of the request in flight; every hold button waits while it runs.
  readonly requestedLotId: string | null;
  hold(lotId: string, onHeld: () => void): void;
  // Reads the hold again, unless a read is already on its way.
  refreshHold(): void;
  dismissProblem(): void;
  acknowledgeFreshHold(): void;
  acknowledgeFreshFailure(): void;
}

// Lives as long as the driver is signed in, above the tabs: the hold read at sign-in or relaunch survives a tab change.
export function useSpotHold(client: SpotHoldClient): SpotHoldController {
  const [held, setHeld] = useState<HeldSpot | null>(null);
  const [readState, setReadState] = useState<SpotHoldReadState>('unknown');
  const [failure, setFailure] = useState<SpotHoldFailure | null>(null);
  const holdsTaken = useRef(0);
  const isReading = useRef(false);
  const updates = useMemo<SpotHoldUpdates>(() => ({ setHeld, setReadState, setFailure, holdsTaken, isReading }), []);
  useEffect(() => void readCurrentHold(client, updates), [client, updates]);
  const { requestedLotId, hold } = useHoldRequest(client, updates);
  const refreshHold = useCallback(() => {
    if (!isReading.current) {
      void readCurrentHold(client, updates);
    }
  }, [client, updates]);
  const dismissProblem = useCallback(() => setFailure(null), []);
  return { held, readState, failure, requestedLotId, hold, refreshHold, dismissProblem, ...useAcknowledgements(setHeld, setFailure) };
}

// The ref refuses a second request while one runs, so a double tap sends one request.
function useHoldRequest(client: SpotHoldClient, updates: SpotHoldUpdates): Pick<SpotHoldController, 'requestedLotId' | 'hold'> {
  const [requestedLotId, setRequestedLotId] = useState<string | null>(null);
  const isRequesting = useRef(false);
  const hold = useCallback(
    (lotId: string, onHeld: () => void) => {
      if (isRequesting.current) {
        return;
      }
      isRequesting.current = true;
      setRequestedLotId(lotId);
      updates.setFailure(null);
      void requestHold(client, lotId, { ...updates, onHeld }).finally(() => {
        isRequesting.current = false;
        setRequestedLotId(null);
      });
    },
    [client, updates],
  );
  return { requestedLotId, hold };
}

function useAcknowledgements(
  setHeld: SpotHoldUpdates['setHeld'],
  setFailure: SpotHoldUpdates['setFailure'],
): Pick<SpotHoldController, 'acknowledgeFreshHold' | 'acknowledgeFreshFailure'> {
  const acknowledgeFreshHold = useCallback(() => setHeld((previous) => (previous?.isFresh === true ? { ...previous, isFresh: false } : previous)), [setHeld]);
  const acknowledgeFreshFailure = useCallback(
    () => setFailure((previous) => (previous?.isFresh === true ? { ...previous, isFresh: false } : previous)),
    [setFailure],
  );
  return { acknowledgeFreshHold, acknowledgeFreshFailure };
}
