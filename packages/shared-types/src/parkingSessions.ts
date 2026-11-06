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
  // The lot's beacon major, which the app monitors while the session lasts; null for a lot without beacons.
  readonly beaconMajor: number | null;
  readonly levelPlan: LevelPlan | null;
}

// D8: an aisle is drawn as a rectangle on its level's grid; the units mean nothing beyond their proportions.
export interface AisleRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// rectangle is null for an aisle the operator has not drawn; its code and minor still guide the driver.
export interface PlanAisle {
  readonly code: string;
  readonly beaconMinor: number;
  readonly rectangle: AisleRectangle | null;
}

// The level of the assigned spot, with its aisles the driver can drive in (exit lanes left out), ordered by code.
export interface LevelPlan {
  readonly levelCode: string;
  readonly aisles: PlanAisle[];
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

export interface ParkedPresumptionRequest {
  readonly detectedAt: string;
}

// The same answer when an earlier signal already recorded the walk: parkedAt is then that first instant.
export interface ParkedPresumptionResponse {
  readonly state: 'PARKED_PRESUMED';
  readonly parkedAt: string;
}

export type ParkedPresumptionRefusalCode = 'SESSION_NOT_FOUND' | 'ENTRY_NOT_CONFIRMED' | 'SESSION_CLOSED';
