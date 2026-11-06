import type { ReactNode } from 'react';
import type { CurrentParkingSessionState } from '../parkingSessions/useCurrentParkingSession';
import type { PositioningCore } from '../positioning/PositioningCore';
import { useAisleMonitoring } from '../positioning/useAisleMonitoring';
import { useCurrentAisle } from '../positioning/useCurrentAisle';
import { ParkingGuidance } from './ParkingGuidance';

// Runs above the tabs: beacons are monitored and the last aisle kept while the driver looks at another tab.
export function useParkingGuidance(positioning: PositioningCore, state: CurrentParkingSessionState): ReactNode {
  const session = state.status === 'current' ? state.session : null;
  useAisleMonitoring(positioning, session);
  const currentAisle = useCurrentAisle(positioning, session);
  return session === null ? null : <ParkingGuidance session={session} currentAisle={currentAisle} />;
}
