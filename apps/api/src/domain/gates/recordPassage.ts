import type { GateKind, GatePassageResponse } from '@palier/shared-types';
import type { Clock } from '../time/Clock.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import type { OpeningWindow, PassageLedger, VehicleCountChange } from './PassageLedger.ts';
import { PassageRefusedError } from './PassageRefusedError.ts';

const ALLOWED_CLOCK_DRIFT_MILLISECONDS = 5 * 60 * 1000;
const FIRST_STORABLE_YEAR = 1;
// Both ends of the comparison are server timestamps (command issue time, server clock), so console clock drift cannot matter.
const OPENING_CONFIRMATION_WINDOW_MILLISECONDS = 60 * 1000;

const VEHICLE_COUNT_CHANGE: Record<GateKind, VehicleCountChange> = { ENTRY: 1, EXIT: -1 };

export interface PassageCommand {
  readonly gate: AuthenticatedGate;
  readonly requestedGateId: string;
  readonly closedAt: Date;
}

export interface PassageCollaborators {
  readonly ledger: PassageLedger;
  readonly clock: Clock;
}

export async function recordPassage(
  command: PassageCommand,
  collaborators: PassageCollaborators,
): Promise<GatePassageResponse> {
  ensurePassageAllowed(command, collaborators.clock());
  const { gate, closedAt } = command;
  const vehicleCountChange = VEHICLE_COUNT_CHANGE[gate.kind];
  const confirmableOpenings = gate.kind === 'ENTRY' ? openingWindowAt(collaborators.clock()) : null;
  const { vehicleCount, confirmedSessionId } = await collaborators.ledger.recordPassage({
    gate,
    closedAt,
    vehicleCountChange,
    confirmableOpenings,
  });
  return { gateId: gate.id, lotId: gate.lotId, kind: gate.kind, closedAt: closedAt.toISOString(), vehicleCount, confirmedSessionId };
}

function openingWindowAt(now: Date): OpeningWindow {
  return { from: new Date(now.getTime() - OPENING_CONFIRMATION_WINDOW_MILLISECONDS) };
}

function ensurePassageAllowed(command: PassageCommand, now: Date): void {
  if (command.gate.id !== command.requestedGateId) {
    throw new PassageRefusedError('GATE_FORBIDDEN');
  }
  if (!command.gate.hasLoops) {
    throw new PassageRefusedError('GATE_WITHOUT_LOOPS');
  }
  if (!isStorableDate(command.closedAt)) {
    throw new PassageRefusedError('CLOSED_AT_INVALID');
  }
  if (command.closedAt.getTime() - now.getTime() > ALLOWED_CLOCK_DRIFT_MILLISECONDS) {
    throw new PassageRefusedError('CLOSED_AT_IN_FUTURE');
  }
}

function isStorableDate(moment: Date): boolean {
  return !Number.isNaN(moment.getTime()) && moment.getUTCFullYear() >= FIRST_STORABLE_YEAR;
}
