import type { CurrentParkingSession, ParkedPresumptionResponse } from '@palier/shared-types';

export interface ParkingSessionClient {
  // The driver's session in progress, priced by the API; null when there is none.
  current(): Promise<CurrentParkingSession | null>;
  // Q36: the device saw the driver walk away from the car at detectedAt (ms). A 404 or 409 rejects with the API's code.
  reportParked(sessionId: string, detectedAt: number): Promise<ParkedPresumptionResponse>;
}
