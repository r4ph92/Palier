import { useEffect, useRef } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { CurrentParkingSessionController } from '../parkingSessions/useCurrentParkingSession';
import type { PositioningCore } from './PositioningCore';
import { watchWalkAway, type LatestSession } from './walkAwayWatch';

export interface ParkedPresumptionTools {
  readonly positioning: PositioningCore;
  readonly client: ParkingSessionClient;
}

// Watches the walk away from the car for as long as a session is current, and never asks the driver anything.
export function useParkedPresumption({ positioning, client }: ParkedPresumptionTools, { state, refresh }: CurrentParkingSessionController): void {
  const session = state.status === 'current' ? state.session : null;
  const latest = useRef<LatestSession>({ session, refresh });
  useEffect(() => {
    latest.current = { session, refresh };
  });
  const sessionId = session?.sessionId ?? null;
  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    const watch = watchWalkAway({ sessionId, positioning, client, latest });
    const unsubscribe = positioning.subscribe(watch.listener);
    return () => {
      watch.stop();
      unsubscribe();
    };
  }, [positioning, client, sessionId]);
}
