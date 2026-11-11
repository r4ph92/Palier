import type { CurrentParkingSession } from '@palier/shared-types';
import { useEffect, useRef } from 'react';
import type { AisleFollower } from '../positioning/AisleFollower';
import type { PositioningCore } from '../positioning/PositioningCore';
import type { OfflineWalkSender } from './OfflineWalkSender';
import { WalkAwayWatch, type LatestSession } from './WalkAwayWatch';

export interface ParkedPresumptionTools {
  readonly positioning: PositioningCore;
  readonly sender: OfflineWalkSender;
  readonly aisles: AisleFollower;
}

// The walk alone presumes the spot taken (Q36); only a walk in another aisle has Palier ask where the car is.
// A session that starts, or comes back after a relaunch, sends the walks kept offline.
export function useParkedPresumption({ positioning, sender, aisles }: ParkedPresumptionTools, session: CurrentParkingSession | null, refresh: () => void): void {
  const latest = useRef<LatestSession>({ session, refresh });
  useEffect(() => {
    latest.current = { session, refresh };
  });
  const sessionId = session?.sessionId ?? null;
  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    return watchWalks(new WalkAwayWatch({ sessionId, positioning, sender, latest: () => latest.current, aisles }), { positioning, sender, aisles });
  }, [positioning, sender, aisles, sessionId]);
}

function watchWalks(watch: WalkAwayWatch, { positioning, sender }: ParkedPresumptionTools): () => void {
  const unsubscribeWalks = positioning.subscribe(watch.listener);
  const unsubscribeReplays = sender.subscribe(watch.replays);
  void sender.flush();
  return () => {
    watch.stop();
    unsubscribeWalks();
    unsubscribeReplays();
  };
}
