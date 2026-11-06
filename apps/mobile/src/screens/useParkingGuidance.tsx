import type { ReactNode } from 'react';
import type { CurrentParkingSessionController } from '../parkingSessions/useCurrentParkingSession';
import { useAisleMonitoring } from '../positioning/useAisleMonitoring';
import { useCurrentAisle } from '../positioning/useCurrentAisle';
import { useParkedPresumption, type ParkedPresumptionTools } from '../positioning/useParkedPresumption';
import { ParkingGuidance } from './ParkingGuidance';

// Runs above the tabs: beacons are monitored, the last aisle kept and the walk away watched while the driver looks at another tab.
// Once the spot is presumed taken the guidance is gone: « Rendez-vous allée A » would contradict « Garé en A-1 ».
export function useParkingGuidance(tools: ParkedPresumptionTools, currentSession: CurrentParkingSessionController): ReactNode {
  const { state } = currentSession;
  const session = state.status === 'current' ? state.session : null;
  useAisleMonitoring(tools.positioning, session);
  const currentAisle = useCurrentAisle(tools.positioning, session);
  useParkedPresumption(tools, currentSession);
  if (session === null || session.state === 'PARKED_PRESUMED') {
    return null;
  }
  return <ParkingGuidance session={session} currentAisle={currentAisle} />;
}
