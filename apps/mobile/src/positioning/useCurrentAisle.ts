import type { PlanAisle } from '@palier/shared-types';
import { useSyncExternalStore } from 'react';
import type { AisleFollower } from './AisleFollower';

export function useCurrentAisle(follower: AisleFollower, sessionId: string | null): PlanAisle | null {
  return useSyncExternalStore(follower.subscribe, () => follower.currentFor(sessionId));
}
