import type { CurrentParkingSession } from '@palier/shared-types';
import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import { PalierConsentRequiredError } from '../api/VehicleClient';

// The amount moves by increments of minutes, so a read every minute keeps it current without ticking on the device.
export const SESSION_REFRESH_MILLISECONDS = 60_000;

export type CurrentParkingSessionState =
  | { readonly status: 'loading' }
  // Palier could not be reached and no session is known yet.
  | { readonly status: 'unknown' }
  | { readonly status: 'none' }
  // isStale: the last refresh missed, so the session and its amount are those read at readAt.
  | { readonly status: 'current'; readonly session: CurrentParkingSession; readonly readAt: Date; readonly isStale: boolean };

export type CurrentParkingSessionReading = Extract<CurrentParkingSessionState, { readonly status: 'current' }>;

// isReading: a read is in flight. missedReads: how many reads the driver started with refresh() failed for lack of network,
// so a retry that fails again is still news. The first read and the minute poll never count: the notice announces once on mount.
export interface ReadProgress {
  readonly isReading: boolean;
  readonly missedReads: number;
}

export interface CurrentParkingSessionController extends ReadProgress {
  readonly state: CurrentParkingSessionState;
  refresh(): void;
  // The same read, as the minute poll does it: a miss is not announced to the driver.
  poll(): void;
}

interface ReadTracker {
  latest: number;
  hasAnswered: boolean;
}

interface ReadContext {
  readonly tracker: ReadTracker;
  readonly setState: Dispatch<SetStateAction<CurrentParkingSessionState>>;
  readonly setProgress: Dispatch<SetStateAction<ReadProgress>>;
  readonly onFirstSession: RefObject<() => void>;
}

const LOADING: CurrentParkingSessionState = { status: 'loading' };
const NONE: CurrentParkingSessionState = { status: 'none' };
const UNKNOWN: CurrentParkingSessionState = { status: 'unknown' };

// Lives as long as the driver is signed in: read at sign-in or relaunch, then every minute.
// onFirstSession runs once, when Palier first answers with a session. It is kept in a ref, so a caller passing
// a new function on each render never restarts the reads.
export function useCurrentParkingSession(client: ParkingSessionClient, onFirstSession: () => void): CurrentParkingSessionController {
  const [state, setState] = useState<CurrentParkingSessionState>(LOADING);
  const [progress, setProgress] = useState<ReadProgress>({ isReading: false, missedReads: 0 });
  const tracker = useRef<ReadTracker>({ latest: 0, hasAnswered: false });
  const latestOnFirstSession = useRef(onFirstSession);
  useEffect(() => {
    latestOnFirstSession.current = onFirstSession;
  });
  const readWith = useCallback(
    (isRetry: boolean) => void read(client, { tracker: tracker.current, setState, setProgress, onFirstSession: latestOnFirstSession }, isRetry),
    [client],
  );
  const refresh = useCallback(() => readWith(true), [readWith]);
  const poll = useCallback(() => readWith(false), [readWith]);
  useMinutePoll(poll);
  return { state, refresh, poll, ...progress };
}

// Read at once, then every minute.
function useMinutePoll(poll: () => void): void {
  useEffect(() => {
    poll();
    const timer = setInterval(poll, SESSION_REFRESH_MILLISECONDS);
    return () => clearInterval(timer);
  }, [poll]);
}

// Only the latest read lands, so a slow answer never replaces a newer one.
async function read(client: ParkingSessionClient, { tracker, setState, setProgress, onFirstSession }: ReadContext, isRetry: boolean): Promise<void> {
  tracker.latest += 1;
  const readNumber = tracker.latest;
  setProgress((previous) => ({ ...previous, isReading: true }));
  try {
    const session = await client.current();
    if (readNumber === tracker.latest) {
      setState(session === null ? NONE : { status: 'current', session, readAt: new Date(), isStale: false });
      announceFirstAnswer(tracker, session, onFirstSession.current);
      setProgress({ isReading: false, missedReads: 0 });
    }
  } catch (error) {
    // Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
    setState((previous) => (readNumber === tracker.latest ? stateAfterFailure(previous, error) : previous));
    if (readNumber === tracker.latest) {
      setProgress((previous) => ({ isReading: false, missedReads: previous.missedReads + (isRetry && error instanceof PalierUnreachableError ? 1 : 0) }));
    }
  }
}

function announceFirstAnswer(tracker: ReadTracker, session: CurrentParkingSession | null, onFirstSession: () => void): void {
  if (!tracker.hasAnswered && session !== null) {
    onFirstSession();
  }
  tracker.hasAnswered = true;
}

// A missed refresh keeps the session on screen with the time of the last read; a driver inside still needs their spot.
// A refused token or a missing notice already moves the app off the tabs.
function stateAfterFailure(previous: CurrentParkingSessionState, error: unknown): CurrentParkingSessionState {
  if (error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError) {
    return previous;
  }
  if (error instanceof PalierUnreachableError) {
    return previous.status === 'current' ? { ...previous, isStale: true } : UNKNOWN;
  }
  throw error;
}
