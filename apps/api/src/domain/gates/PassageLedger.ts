import type { AuthenticatedGate } from './AuthenticatedGate.ts';

export type VehicleCountChange = 1 | -1;

export interface OpeningWindow {
  readonly from: Date;
}

export interface PassageEntry {
  readonly gate: AuthenticatedGate;
  readonly closedAt: Date;
  readonly vehicleCountChange: VehicleCountChange;
  // Openings issued inside this window may be confirmed by the passage; null when the gate confirms nothing.
  readonly confirmableOpenings: OpeningWindow | null;
}

export interface RecordedPassage {
  readonly vehicleCount: number;
  readonly confirmedSessionId: string | null;
}

export interface PassageLedger {
  recordPassage(entry: PassageEntry): Promise<RecordedPassage>;
}
