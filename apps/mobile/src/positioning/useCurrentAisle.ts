import type { PlanAisle } from '@palier/shared-types';
import type { CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AisleFollower } from './AisleFollower';
import type { PositioningCore } from './PositioningCore';

// One follower for as long as the driver is signed in, subscribed once to the core and told which session to follow.
export function useAisleFollower(positioning: PositioningCore, state: CurrentParkingSessionState): AisleFollower {
  const session = state.status === 'current' ? state.session : null;
  const [follower] = useState(() => new AisleFollower());
  useEffect(() => positioning.subscribe(follower.listener), [positioning, follower]);
  const sessionId = session?.sessionId ?? null;
  const aisles = session?.levelPlan?.aisles;
  useEffect(() => {
    follower.follow(sessionId === null ? null : { sessionId, aisles: aisles ?? [] });
  }, [follower, sessionId, aisles]);
  return follower;
}

export function useCurrentAisle(follower: AisleFollower, sessionId: string | null): PlanAisle | null {
  return useSyncExternalStore(follower.subscribe, () => follower.currentFor(sessionId));
}
