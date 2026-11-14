import type { GateKind } from '@palier/shared-types';

export interface StoredGate {
  readonly id: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly lastHeartbeatAt: Date | null;
}

export interface LotGates {
  readonly lotName: string;
  readonly gates: readonly StoredGate[];
}

// Never reads a gate's QR secret or endpoint: the dashboard has no use for them.
export interface LotEquipmentReader {
  // Null when the operator has no lot with this id, so another operator's lot reads as absent.
  readLotGates(operatorId: string, lotId: string): Promise<LotGates | null>;
}
