import type { CurrentParkingSession } from '@palier/shared-types';

export interface ParkingSessionClient {
  // The driver's session in progress, priced by the API; null when there is none.
  current(): Promise<CurrentParkingSession | null>;
}
