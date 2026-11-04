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
}
