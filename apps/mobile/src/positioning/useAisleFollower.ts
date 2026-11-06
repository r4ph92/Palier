import type { CurrentParkingSession } from '@palier/shared-types';
import { useEffect, useState } from 'react';
import { AisleFollower } from './AisleFollower';
import type { PositioningCore } from './PositioningCore';

// One follower for as long as the driver is signed in, subscribed once to the core and told which session to follow.
export function useAisleFollower(positioning: PositioningCore, session: CurrentParkingSession | null): AisleFollower {
  const [follower] = useState(() => new AisleFollower());
  useEffect(() => positioning.subscribe(follower.listener), [positioning, follower]);
  const sessionId = session?.sessionId ?? null;
  const aisles = session?.levelPlan?.aisles;
  useEffect(() => {
    follower.follow(sessionId === null ? null : { sessionId, aisles: aisles ?? [] });
  }, [follower, sessionId, aisles]);
  return follower;
}
