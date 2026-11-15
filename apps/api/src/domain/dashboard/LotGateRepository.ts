import type { DashboardErrorCode, DashboardLotGates } from '@palier/shared-types';
import type { GateDraft, GateSettings } from '@palier/shared-types/gateDraft';

export type LotGateRefusal = Extract<
  DashboardErrorCode,
  'LOT_NOT_FOUND' | 'LOT_BUSY' | 'GATE_NOT_FOUND' | 'GATE_NAME_TAKEN' | 'GATE_EXIT_LIMIT' | 'GATE_LIMIT_REACHED' | 'GATE_EXIT_ID_ON_ENTRY'
>;

// written: the gate added or changed, committed; refused: nothing was saved.
export type GateWrite = { readonly kind: 'written'; readonly gateId: string } | { readonly kind: 'refused'; readonly reason: LotGateRefusal };

export function gateWritten(gateId: string): GateWrite {
  return { kind: 'written', gateId };
}

export function gateRefused(reason: LotGateRefusal): GateWrite {
  return { kind: 'refused', reason };
}

export interface GatePlace {
  readonly lotId: string;
  readonly gateId: string;
}

// The operator's draft and the gate's first secrets: only the device key's hash is stored (decision 006).
export interface NewGate {
  readonly draft: GateDraft;
  readonly qrSecret: string;
  readonly deviceKeyHash: string;
}

// Every statement names the operator; a write first locks the operator's lot, so another operator's lot is LOT_NOT_FOUND
// and a gate of another lot is GATE_NOT_FOUND before anything else is read. Never reads a device key or a QR secret.
export interface LotGateRepository {
  // Null when the operator has no lot with this id.
  readLotGates(operatorId: string, lotId: string): Promise<DashboardLotGates | null>;
  // Counted under the lock: at most MAX_GATES_PER_LOT gates, and one exit gate per lot for now (decision 039).
  addGate(operatorId: string, lotId: string, gate: NewGate): Promise<GateWrite>;
  // An entry gate's exit identification stays NONE: anything else is GATE_EXIT_ID_ON_ENTRY.
  changeGate(operatorId: string, gate: GatePlace, settings: GateSettings): Promise<GateWrite>;
}
