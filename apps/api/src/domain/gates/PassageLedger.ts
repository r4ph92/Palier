import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import type { OpeningWindow } from './OpeningWindow.ts';

export type VehicleCountChange = 1 | -1;

export interface PassageEntry {
  readonly gate: AuthenticatedGate;
  readonly closedAt: Date;
  readonly vehicleCountChange: VehicleCountChange;
  // Openings issued within this duration before the database clock's now may be confirmed by the passage; null when the gate confirms nothing.
  readonly confirmableOpenings: OpeningWindow | null;
}

export interface RecordedPassage {
  readonly vehicleCount: number;
  readonly confirmedSessionId: string | null;
}

export interface PassageLedger {
  recordPassage(entry: PassageEntry): Promise<RecordedPassage>;
}
