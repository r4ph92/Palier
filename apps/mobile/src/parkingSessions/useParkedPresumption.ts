import type { CurrentParkingSession } from '@palier/shared-types';
import { useEffect, useRef, type RefObject } from 'react';
import type { ParkingSessionClient } from '../api/ParkingSessionClient';
import type { AisleFollower } from '../positioning/AisleFollower';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { ParkedSignalQueue } from './ParkedSignalQueue';
import { WalkAwayWatch, type LatestSession } from './WalkAwayWatch';

export interface ParkedPresumptionTools {
  readonly positioning: PositioningCore;
  readonly client: ParkingSessionClient;
  readonly aisles: AisleFollower;
  readonly queue: ParkedSignalQueue;
}

// The walk alone presumes the spot taken (Q36); only a walk in another aisle has Palier ask where the car is.
export function useParkedPresumption(tools: ParkedPresumptionTools, session: CurrentParkingSession | null, refresh: () => void): void {
  const latest = useRef<LatestSession>({ session, refresh });
  useEffect(() => {
    latest.current = { session, refresh };
  });
  const sessionId = session?.sessionId ?? null;
  const { positioning, client, aisles, queue } = tools;
  useEffect(() => {
    return sessionId === null ? undefined : startWatch({ positioning, client, aisles, queue }, sessionId, latest);
  }, [positioning, client, aisles, queue, sessionId]);
}

function startWatch(tools: ParkedPresumptionTools, sessionId: string, latest: RefObject<LatestSession>): () => void {
  const watch = new WalkAwayWatch({ ...tools, sessionId, latest: () => latest.current, connectivity: tools.positioning.connectivity });
  const unsubscribe = tools.positioning.subscribe(watch.listener);
  return () => {
    watch.stop();
    unsubscribe();
  };
}
