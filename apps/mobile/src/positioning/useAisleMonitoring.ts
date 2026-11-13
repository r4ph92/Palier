import type { CurrentParkingSession } from '@palier/shared-types';
import { PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';
import { useEffect } from 'react';
import type { PositioningCore } from './PositioningCore';

// Monitoring follows the session and its lot, not each read: a minute's poll with the same session never restarts it,
// and the cleanup stops only what this effect started.
export function useAisleMonitoring(positioning: PositioningCore, session: CurrentParkingSession | null): void {
  const sessionId = session?.sessionId ?? null;
  const beaconMajor = session?.beaconMajor ?? null;
  useEffect(() => {
    if (sessionId === null || beaconMajor === null) {
      return;
    }
    positioning.startMonitoring(PLATFORM_BEACON_UUID, beaconMajor);
    return () => positioning.stopMonitoring();
  }, [positioning, sessionId, beaconMajor]);
}
