import type { CurrentParkingSession, ParkedPresumptionResponse, ParkedSpotAnswerResponse, SpotTakenResponse } from '@palier/shared-types';

// detectedAt in ms; aisleMinor: the aisle the device last saw, null when it saw none.
export interface DetectedWalk {
  readonly detectedAt: number;
  readonly aisleMinor: number | null;
}

export interface ParkingSessionClient {
  // The driver's session in progress, priced by the API; null when there is none.
  current(): Promise<CurrentParkingSession | null>;
  // Q36: the device saw the driver walk away from the car. A 404 or 409 rejects with the API's code.
  reportParked(sessionId: string, walk: DetectedWalk): Promise<ParkedPresumptionResponse>;
  // The spot number the driver read on the ground. A 404 or 409 rejects with the API's code, a 400 with its status.
  answerParkedSpot(sessionId: string, spotNumber: string): Promise<ParkedSpotAnswerResponse>;
  // The assigned spot, named as shown, has a car in it before the driver parked. A 404 or 409 rejects with the API's code.
  reportSpotTaken(sessionId: string, spotNumber: string): Promise<SpotTakenResponse>;
}
