import type { AuthenticatedGate } from './AuthenticatedGate.ts';

export type VehicleCountChange = 1 | -1;

export interface PassageEntry {
  readonly gate: AuthenticatedGate;
  readonly closedAt: Date;
  readonly vehicleCountChange: VehicleCountChange;
}

export interface RecordedPassage {
  readonly vehicleCount: number;
}

export interface PassageLedger {
  recordPassage(entry: PassageEntry): Promise<RecordedPassage>;
}
