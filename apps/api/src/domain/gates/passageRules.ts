import type { GateKind } from '@palier/shared-types';
import { PRESENCE_WINDOW_DAYS } from '@palier/shared-types/gates';
import { MILLISECONDS_PER_DAY } from '../time/durations.ts';
import { isStorableDate } from '../time/storableDate.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import { ensureOwnGate } from './ownGate.ts';
import { PassageRefusedError } from './PassageRefusedError.ts';
import { ALLOWED_CLOCK_DRIFT_MILLISECONDS } from './passageWindow.ts';
import type { VehicleCountChange } from './PassageLedger.ts';

const PRESENCE_WINDOW_MILLISECONDS = PRESENCE_WINDOW_DAYS * MILLISECONDS_PER_DAY;
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
  if (armedAt === null || !isStorableDate(armedAt)) {
    return null;
  }
  const presenceMilliseconds = closedAt.getTime() - armedAt.getTime();
  return presenceMilliseconds < 0 || presenceMilliseconds > PRESENCE_WINDOW_MILLISECONDS ? null : armedAt;
}

export function ensureClosedAtIsPlausible(closedAt: Date, now: Date): void {
  if (!isStorableDate(closedAt)) {
    throw new PassageRefusedError('CLOSED_AT_INVALID');
  }
  if (closedAt.getTime() - now.getTime() > ALLOWED_CLOCK_DRIFT_MILLISECONDS) {
    throw new PassageRefusedError('CLOSED_AT_IN_FUTURE');
  }
}
