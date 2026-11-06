import type { ReactNode } from 'react';
import type { CurrentParkingSession } from '@palier/shared-types';
import type { AisleFollower } from '../positioning/AisleFollower';
import type { PositioningCore } from '../positioning/PositioningCore';
import { isParked } from '../parkingSessions/isParked';
import { useAisleMonitoring } from '../positioning/useAisleMonitoring';
import { useCurrentAisle } from '../positioning/useCurrentAisle';
import { ParkingGuidance } from './ParkingGuidance';

// Runs above the tabs: beacons are monitored and the last aisle kept while the driver looks at another tab.
// Once the spot is presumed taken the guidance is gone: « Rendez-vous allée A » would contradict « Garé en A-1 ».
export function useParkingGuidance(positioning: PositioningCore, aisles: AisleFollower, session: CurrentParkingSession | null): ReactNode {
  useAisleMonitoring(positioning, session);
  const currentAisle = useCurrentAisle(aisles, session?.sessionId ?? null);
  if (session === null || isParked(session.state)) {
    return null;
  }
  return <ParkingGuidance session={session} currentAisle={currentAisle} />;
}
