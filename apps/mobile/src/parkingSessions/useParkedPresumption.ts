import type { CurrentParkingSession } from '@palier/shared-types';
import { useEffect, useRef } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { AisleFollower } from '../positioning/AisleFollower';
import type { PositioningCore } from '../positioning/PositioningCore';
import { WalkAwayWatch, type LatestSession } from './WalkAwayWatch';

export interface ParkedPresumptionTools {
  readonly positioning: PositioningCore;
  readonly client: ParkingSessionClient;
  readonly aisles: AisleFollower;
}

// The walk alone presumes the spot taken (Q36); only a walk in another aisle has Palier ask where the car is.
export function useParkedPresumption({ positioning, client, aisles }: ParkedPresumptionTools, session: CurrentParkingSession | null, refresh: () => void): void {
  const latest = useRef<LatestSession>({ session, refresh });
  useEffect(() => {
    latest.current = { session, refresh };
  });
  const sessionId = session?.sessionId ?? null;
  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    const watch = new WalkAwayWatch({ sessionId, positioning, client, latest: () => latest.current, aisles });
    const unsubscribe = positioning.subscribe(watch.listener);
    return () => {
      watch.stop();
      unsubscribe();
    };
  }, [positioning, client, aisles, sessionId]);
}
