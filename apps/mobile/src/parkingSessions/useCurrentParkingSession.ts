import type { CurrentParkingSession } from '@palier/shared-types';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
  | { readonly status: 'current'; readonly session: CurrentParkingSession; readonly readAt: Date };

export interface CurrentParkingSessionController {
  readonly state: CurrentParkingSessionState;
  refresh(): void;
}

interface ReadTracker {
  latest: number;
  hasAnswered: boolean;
}

interface ReadContext {
  readonly tracker: ReadTracker;
  readonly setState: Dispatch<SetStateAction<CurrentParkingSessionState>>;
  readonly onFirstSession: () => void;
}

const LOADING: CurrentParkingSessionState = { status: 'loading' };
const NONE: CurrentParkingSessionState = { status: 'none' };
const UNKNOWN: CurrentParkingSessionState = { status: 'unknown' };

// Lives as long as the driver is signed in: read at sign-in or relaunch, then every minute.
// onFirstSession runs once, when Palier first answers with a session.
export function useCurrentParkingSession(client: ParkingSessionClient, onFirstSession: () => void): CurrentParkingSessionController {
  const [state, setState] = useState<CurrentParkingSessionState>(LOADING);
  const tracker = useRef<ReadTracker>({ latest: 0, hasAnswered: false });
  const refresh = useCallback(() => void read(client, { tracker: tracker.current, setState, onFirstSession }), [client, onFirstSession]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, SESSION_REFRESH_MILLISECONDS);
    return () => clearInterval(timer);
  }, [refresh]);
  return { state, refresh };
}

// Only the latest read lands, so a slow answer never replaces a newer one.
async function read(client: ParkingSessionClient, { tracker, setState, onFirstSession }: ReadContext): Promise<void> {
  tracker.latest += 1;
  const readNumber = tracker.latest;
  try {
    const session = await client.current();
    if (readNumber === tracker.latest) {
      setState(session === null ? NONE : { status: 'current', session, readAt: new Date() });
      announceFirstAnswer(tracker, session, onFirstSession);
    }
  } catch (error) {
    // Run inside the state update so an unexpected error is thrown during render and reaches the error boundary.
    setState((previous) => (readNumber === tracker.latest ? stateAfterFailure(previous, error) : previous));
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
    return previous.status === 'current' ? previous : UNKNOWN;
  }
  throw error;
}
