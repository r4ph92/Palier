import { isStorableDate } from '../time/storableDate.ts';
import type { GateKind, GatePassageResponse } from '@palier/shared-types';
import type { Clock } from '../time/Clock.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import type { OpeningWindow } from './OpeningWindow.ts';
import type { PassageLedger, VehicleCountChange } from './PassageLedger.ts';
import { PassageRefusedError } from './PassageRefusedError.ts';

const ALLOWED_CLOCK_DRIFT_MILLISECONDS = 5 * 60 * 1000;
const VEHICLE_COUNT_CHANGE: Record<GateKind, VehicleCountChange> = { ENTRY: 1, EXIT: -1 };

export interface PassageCommand {
  readonly gate: AuthenticatedGate;
  readonly requestedGateId: string;
  readonly closedAt: Date;
}

export interface PassageCollaborators {
  readonly ledger: PassageLedger;
  readonly clock: Clock;
  // A duration judged by the database clock that stamped the command; the cancellation job gets the same object, so both agree.
  readonly openingWindow: OpeningWindow;
}

export async function recordPassage(
  command: PassageCommand,
  collaborators: PassageCollaborators,
): Promise<GatePassageResponse> {
  ensurePassageAllowed(command, collaborators.clock());
  const { gate, closedAt } = command;
  const vehicleCountChange = VEHICLE_COUNT_CHANGE[gate.kind];
  const confirmableOpenings = gate.kind === 'ENTRY' ? collaborators.openingWindow : null;
  const { vehicleCount, confirmedSessionId } = await collaborators.ledger.recordPassage({
    gate,
    closedAt,
    vehicleCountChange,
    confirmableOpenings,
  });
  return { gateId: gate.id, lotId: gate.lotId, kind: gate.kind, closedAt: closedAt.toISOString(), vehicleCount, confirmedSessionId };
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
