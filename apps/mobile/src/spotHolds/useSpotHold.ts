import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpotHoldClient } from '../api/SpotHoldClient';
import type { HeldSpot } from './heldSpot';
import type { SpotHoldFailure } from './spotHoldFailure';
import { readCurrentHold, releaseHold, requestHold, type ReleaseCallbacks, type SpotHoldReadState, type SpotHoldUpdates } from './spotHoldRequests';

export interface SpotHoldController {
  readonly held: HeldSpot | null;
  readonly readState: SpotHoldReadState;
  readonly failure: SpotHoldFailure | null;
  // The lot of the request in flight; every hold button waits while it runs.
  readonly requestedLotId: string | null;
  hold(lotId: string, onHeld: () => void): void;
  readonly isReleasing: boolean;
  release(callbacks: ReleaseCallbacks): void;
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

function useHoldRequest(client: SpotHoldClient, updates: SpotHoldUpdates): Pick<SpotHoldController, 'requestedLotId' | 'hold'> {
  const { runningKey: requestedLotId, run } = useSingleFlight<string>();
  const hold = useCallback(
    (lotId: string, onHeld: () => void) => {
      run(lotId, () => {
        updates.setFailure(null);
        return requestHold(client, lotId, { ...updates, onHeld });
      });
    },
    [client, updates, run],
  );
  return { requestedLotId, hold };
}

function useReleaseRequest(client: SpotHoldClient, updates: SpotHoldUpdates, held: HeldSpot | null): Pick<SpotHoldController, 'isReleasing' | 'release'> {
  const { runningKey, run } = useSingleFlight<string>();
  const spotHoldId = held?.spotHold.spotHoldId;
  const release = useCallback(
    (callbacks: ReleaseCallbacks) => {
      if (spotHoldId !== undefined) {
        run(spotHoldId, () => releaseHold(client, spotHoldId, { ...updates, ...callbacks }));
      }
    },
    [client, updates, run, spotHoldId],
  );
  return { isReleasing: runningKey !== null, release };
}

// The ref refuses a second task while one runs, so a double tap sends one request.
function useSingleFlight<Key>() {
  const [runningKey, setRunningKey] = useState<Key | null>(null);
  const isRunning = useRef(false);
  const run = useCallback((key: Key, task: () => Promise<void>) => {
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;
    setRunningKey(key);
    void task().finally(() => {
      isRunning.current = false;
      setRunningKey(null);
    });
  }, []);
  return { runningKey, run };
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
