import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpotHoldClient } from '../api/SpotHoldClient';
import type { HeldSpot } from './heldSpot';
import type { SpotHoldFailure } from './spotHoldFailure';
import { readCurrentHold, requestHold, type SpotHoldUpdates } from './spotHoldReads';

export interface SpotHoldController {
  readonly held: HeldSpot | null;
  readonly failure: SpotHoldFailure | null;
  // The lot of the request in flight; every hold button waits while it runs.
  readonly requestedLotId: string | null;
  hold(lotId: string, onHeld: () => void): void;
  // Clears the last problem and reads the hold again; the lot list calls it on every read.
  refreshHold(): void;
  acknowledgeFreshHold(): void;
  acknowledgeFreshFailure(): void;
}

// Lives as long as the driver is signed in, above the tabs: the hold read at sign-in or relaunch survives a tab change.
export function useSpotHold(client: SpotHoldClient): SpotHoldController {
  const [held, setHeld] = useState<HeldSpot | null>(null);
  const [failure, setFailure] = useState<SpotHoldFailure | null>(null);
  const holdsTaken = useRef(0);
  const updates = useMemo<SpotHoldUpdates>(() => ({ setHeld, setFailure, holdsTaken }), []);
  useEffect(() => void readCurrentHold(client, updates), [client, updates]);
  const { requestedLotId, hold } = useHoldRequest(client, updates);
  const refreshHold = useCallback(() => {
    setFailure(null);
    void readCurrentHold(client, updates);
  }, [client, updates]);
  return { held, failure, requestedLotId, hold, refreshHold, ...useAcknowledgements(setHeld, setFailure) };
}

// The ref refuses a second request while one runs, so a double tap sends one request.
function useHoldRequest(client: SpotHoldClient, { setHeld, setFailure, holdsTaken }: SpotHoldUpdates): Pick<SpotHoldController, 'requestedLotId' | 'hold'> {
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
      void requestHold(client, lotId, { setHeld, setFailure, holdsTaken, onHeld }).finally(() => {
        isRequesting.current = false;
        setRequestedLotId(null);
      });
    },
    [client, setHeld, setFailure, holdsTaken],
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
