export type GateKind = 'ENTRY' | 'EXIT';

// Four missed beats of the console's 30 s heartbeat (decision 035).
export const SILENT_GATE_AFTER_MINUTES = 2;

// NEVER_HEARD: no heartbeat since the gate was set up; SILENT: none for more than SILENT_GATE_AFTER_MINUTES.
export type GateHealth = 'ONLINE' | 'SILENT' | 'NEVER_HEARD';

export interface GateIdentity {
  readonly id: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly lotName: string;
}

export interface GatePassageRequest {
  readonly closedAt: string;
}

export interface GatePassageResponse {
  readonly gateId: string;
  readonly lotId: string;
  readonly kind: GateKind;
  readonly closedAt: string;
  readonly vehicleCount: number;
  // The entry session this passage confirmed; null when no opening was waiting.
  readonly confirmedSessionId: string | null;
  // The paid session whose exit opening this passage closed; null when no opening was waiting.
  readonly exitedSessionId: string | null;
}

export interface PassageReplayItem {
  // Chosen by the controller when it counts the passage: sending the same id again counts nothing more.
  readonly id: string;
  readonly kind: GateKind;
  readonly closedAt: string;
}

export interface PassageReplayRequest {
  readonly passages: readonly PassageReplayItem[];
}

export interface PassageReplayResponse {
  readonly counted: number;
  readonly duplicates: number;
  readonly vehicleCount: number;
}

// What the exit reader read: a plate or a transponder identifier, in any case, with or without spaces.
export interface GateIdentifyRequest {
  readonly identifier: string;
}

// opened: the barrier was ordered open for the identified vehicle; fallback: nothing was taken or opened, the driver uses the app.
export interface GateIdentifyResponse {
  readonly outcome: 'opened' | 'fallback';
  readonly identification: 'plate' | 'transponder' | null;
}

// waiting: the vehicle is noted and no single app has reported the exit beacon yet; opened: the barrier was ordered open;
// fallback: two apps reported, so nothing opened and both drivers use the tap.
export interface GatePresenceResponse {
  readonly outcome: 'waiting' | 'opened' | 'fallback';
}
