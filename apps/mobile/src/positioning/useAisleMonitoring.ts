import type { CurrentParkingSession } from '@palier/shared-types';
import { useEffect } from 'react';
import { DEVELOPMENT_BEACON_UUID } from './developmentBeacon';
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
    positioning.startMonitoring(DEVELOPMENT_BEACON_UUID, beaconMajor);
    return () => positioning.stopMonitoring();
  }, [positioning, sessionId, beaconMajor]);
}
