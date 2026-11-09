export type GateKind = 'ENTRY' | 'EXIT';

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
