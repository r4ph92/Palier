import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import type { OpeningWindow } from './OpeningWindow.ts';

export type VehicleCountChange = 1 | -1;

export interface PassageEntry {
  readonly gate: AuthenticatedGate;
  readonly closedAt: Date;
  readonly vehicleCountChange: VehicleCountChange;
  // Openings issued within this duration before the database clock's now may be confirmed by the passage; null when the gate confirms nothing.
  readonly confirmableOpenings: OpeningWindow | null;
  // Exit openings issued within this duration before the database clock's now may be attached to their session by the passage; null at an entry gate.
  readonly attachableOpenings: OpeningWindow | null;
}

export interface RecordedPassage {
  readonly vehicleCount: number;
  readonly confirmedSessionId: string | null;
  readonly exitedSessionId: string | null;
}

export interface ReplayedPassage {
  readonly id: string;
  readonly closedAt: Date;
}

export interface ReplayEntry {
  readonly gate: AuthenticatedGate;
  readonly passages: readonly ReplayedPassage[];
  readonly vehicleCountChange: VehicleCountChange;
}

export interface RecordedReplay {
  readonly counted: number;
  readonly duplicates: number;
  readonly vehicleCount: number;
}

export interface PassageLedger {
  recordPassage(entry: PassageEntry): Promise<RecordedPassage>;
  // Only moves the counter: a replayed passage confirms no session and attaches no exit. An id already recorded for the gate counts nothing.
  recordReplay(entry: ReplayEntry): Promise<RecordedReplay>;
}
