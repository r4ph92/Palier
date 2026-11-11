import { isStorableDate } from '../time/storableDate.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import { PassageRefusedError } from './PassageRefusedError.ts';

const ALLOWED_CLOCK_DRIFT_MILLISECONDS = 5 * 60 * 1000;

export function ensureGateMayReport(gate: AuthenticatedGate, requestedGateId: string): void {
  if (gate.id !== requestedGateId) {
    throw new PassageRefusedError('GATE_FORBIDDEN');
  }
  if (!gate.hasLoops) {
    throw new PassageRefusedError('GATE_WITHOUT_LOOPS');
  }
}

export function ensureClosedAtIsPlausible(closedAt: Date, now: Date): void {
  if (!isStorableDate(closedAt)) {
    throw new PassageRefusedError('CLOSED_AT_INVALID');
  }
  if (closedAt.getTime() - now.getTime() > ALLOWED_CLOCK_DRIFT_MILLISECONDS) {
    throw new PassageRefusedError('CLOSED_AT_IN_FUTURE');
  }
}
