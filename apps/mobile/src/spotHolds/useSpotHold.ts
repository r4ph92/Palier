import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpotHoldClient } from '../api/SpotHoldClient';
import type { HeldSpot } from './heldSpot';
import type { SpotHoldFailure } from './spotHoldFailure';
import { readCurrentHold, releaseHold, requestHold, type SpotHoldReadState, type SpotHoldUpdates } from './spotHoldRequests';

export interface SpotHoldController {
  readonly held: HeldSpot | null;
  readonly readState: SpotHoldReadState;
  readonly failure: SpotHoldFailure | null;
  // The lot of the request in flight; every hold button waits while it runs.
  readonly requestedLotId: string | null;
  hold(lotId: string, onHeld: () => void): void;
  // True while the release of the hold on screen runs.
  readonly isReleasing: boolean;
  release(onReleased: () => void): void;
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
  const holdChanges = useRef(0);
  const isReading = useRef(false);
  const updates = useMemo<SpotHoldUpdates>(() => ({ setHeld, setReadState, setFailure, holdChanges, isReading }), []);
  useEffect(() => void readCurrentHold(client, updates), [client, updates]);
  const { requestedLotId, hold } = useHoldRequest(client, updates);
  const { isReleasing, release } = useReleaseRequest(client, updates, held);
  const refreshHold = useCallback(() => {
    if (!isReading.current) {
      void readCurrentHold(client, updates);
    }
  }, [client, updates]);
  const dismissProblem = useCallback(() => setFailure(null), []);
  return { held, readState, failure, requestedLotId, hold, isReleasing, release, refreshHold, dismissProblem, ...useAcknowledgements(setHeld, setFailure) };
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

// The same ref guard as a hold request: a double tap on « Confirmer » sends one release.
function useReleaseRequest(client: SpotHoldClient, updates: SpotHoldUpdates, held: HeldSpot | null): Pick<SpotHoldController, 'isReleasing' | 'release'> {
  const [isReleasing, setIsReleasing] = useState(false);
  const isRequesting = useRef(false);
  const spotHoldId = held?.spotHold.spotHoldId;
  const release = useCallback(
    (onReleased: () => void) => {
      if (isRequesting.current || spotHoldId === undefined) {
        return;
      }
      isRequesting.current = true;
      setIsReleasing(true);
      void releaseHold(client, spotHoldId, { ...updates, onReleased }).finally(() => {
        isRequesting.current = false;
        setIsReleasing(false);
      });
    },
    [client, updates, spotHoldId],
  );
  return { isReleasing, release };
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
