import type { GatePassageResponse } from '@palier/shared-types';
import type { Clock } from '../time/Clock.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import type { OpeningWindow } from './OpeningWindow.ts';
import type { PassageLedger } from './PassageLedger.ts';
import { ensureClosedAtIsPlausible, ensureGateMayReport, vehicleCountChangeFor } from './passageRules.ts';

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
  ensureGateMayReport(command.gate, command.requestedGateId);
  ensureClosedAtIsPlausible(command.closedAt, collaborators.clock());
  const { gate, closedAt } = command;
  const vehicleCountChange = vehicleCountChangeFor(gate.kind);
  const confirmableOpenings = gate.kind === 'ENTRY' ? collaborators.openingWindow : null;
  const attachableOpenings = gate.kind === 'EXIT' ? collaborators.openingWindow : null;
  const recorded = await collaborators.ledger.recordPassage({
    gate,
    closedAt,
    vehicleCountChange,
    confirmableOpenings,
    attachableOpenings,
  });
  return { gateId: gate.id, lotId: gate.lotId, kind: gate.kind, closedAt: closedAt.toISOString(), ...recorded };
}
