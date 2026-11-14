import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import { GateForbiddenError } from './GateForbiddenError.ts';

// A key speaks only for its own gate, whatever id the path names.
export function ensureOwnGate(gate: AuthenticatedGate, requestedGateId: string): void {
  if (gate.id !== requestedGateId) {
    throw new GateForbiddenError();
  }
}
