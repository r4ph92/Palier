import type { GateKind } from '@palier/shared-types';
import { isStorableDate } from '../time/storableDate.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import { ensureOwnGate } from './ownGate.ts';
import { PassageRefusedError } from './PassageRefusedError.ts';
import type { VehicleCountChange } from './PassageLedger.ts';

const ALLOWED_CLOCK_DRIFT_MILLISECONDS = 5 * 60 * 1000;
const VEHICLE_COUNT_CHANGE: Record<GateKind, VehicleCountChange> = { ENTRY: 1, EXIT: -1 };

export function vehicleCountChangeFor(kind: GateKind): VehicleCountChange {
  return VEHICLE_COUNT_CHANGE[kind];
}

export function ensureGateMayReport(gate: AuthenticatedGate, requestedGateId: string): void {
  ensureOwnGate(gate, requestedGateId);
  if (!gate.hasLoops) {
    throw new PassageRefusedError('GATE_WITHOUT_LOOPS');
  }
}

// A controller clock fault must never drop a vehicle count: an arming time that cannot be right is forgotten, the passage still counts.
export function presenceArmingOf(armedAt: Date | null, closedAt: Date): Date | null {
  if (armedAt === null || !isStorableDate(armedAt) || armedAt.getTime() > closedAt.getTime()) {
    return null;
  }
  return armedAt;
}

export function ensureClosedAtIsPlausible(closedAt: Date, now: Date): void {
  if (!isStorableDate(closedAt)) {
    throw new PassageRefusedError('CLOSED_AT_INVALID');
  }
  if (closedAt.getTime() - now.getTime() > ALLOWED_CLOCK_DRIFT_MILLISECONDS) {
    throw new PassageRefusedError('CLOSED_AT_IN_FUTURE');
  }
}
