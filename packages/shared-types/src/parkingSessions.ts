import type { ActiveEntrySessionState, AssignedSpot } from './entries.ts';

// The driver's session in progress, priced by the API's clock: the app shows these figures as they are.
export interface CurrentParkingSession {
  readonly sessionId: string;
  readonly state: ActiveEntrySessionState;
  readonly lotName: string;
  readonly spot: AssignedSpot;
  // When the driver scanned at the entry terminal; billing starts then.
  readonly enteredAt: string;
  readonly elapsedMinutes: number;
  readonly amountCents: number;
  readonly dailyCapCents: number;
}

export interface CurrentParkingSessionResponse {
  readonly session: CurrentParkingSession | null;
}

// Test environments only: the instant the API's clock reads.
export interface TestClockReading {
  readonly now: string;
}

export interface BackdateParkingSessionRequest {
  readonly enteredAt: string;
}
