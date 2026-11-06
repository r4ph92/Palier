import { useEffect, useRef } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { CurrentParkingSessionController } from './useCurrentParkingSession';
import { WalkAwayWatch, type LatestSession } from './WalkAwayWatch';

export interface ParkedPresumptionTools {
  readonly positioning: PositioningCore;
  readonly client: ParkingSessionClient;
}

// Never asks the driver anything: the walk alone presumes the spot taken (Q36).
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
    const watch = new WalkAwayWatch({ sessionId, positioning, client, latest: () => latest.current });
    const unsubscribe = positioning.subscribe(watch.listener);
    return () => {
      watch.stop();
      unsubscribe();
    };
  }, [positioning, client, sessionId]);
}
