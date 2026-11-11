import type { GateKind, PassageReplayResponse } from '@palier/shared-types';
import type { Clock } from '../time/Clock.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import { PassageRefusedError } from './PassageRefusedError.ts';
import { ensureClosedAtIsPlausible, ensureGateMayReport } from './passageRules.ts';
import type { PassageLedger, ReplayedPassage, VehicleCountChange } from './PassageLedger.ts';

const MAXIMUM_AGE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const VEHICLE_COUNT_CHANGE: Record<GateKind, VehicleCountChange> = { ENTRY: 1, EXIT: -1 };

export interface ReplayedPassageCommand extends ReplayedPassage {
  readonly kind: GateKind;
}

export interface ReplayCommand {
  readonly gate: AuthenticatedGate;
  readonly requestedGateId: string;
  readonly passages: readonly ReplayedPassageCommand[];
}

export interface ReplayCollaborators {
  readonly ledger: PassageLedger;
  readonly clock: Clock;
}

// Every passage is checked before any is written, so a refused batch counts nothing.
export async function replayPassages(command: ReplayCommand, collaborators: ReplayCollaborators): Promise<PassageReplayResponse> {
  const { gate, passages } = command;
  ensureGateMayReport(gate, command.requestedGateId);
  ensureBatchIsConsistent(gate, passages);
  const now = collaborators.clock();
  passages.forEach((passage) => ensureReplayedClosedAtIsPlausible(passage.closedAt, now));
  return collaborators.ledger.recordReplay({
    gate,
    passages: passages.map(({ id, closedAt }) => ({ id, closedAt })),
    vehicleCountChange: VEHICLE_COUNT_CHANGE[gate.kind],
  });
}

function ensureBatchIsConsistent(gate: AuthenticatedGate, passages: readonly ReplayedPassageCommand[]): void {
  if (passages.some((passage) => passage.kind !== gate.kind)) {
    throw new PassageRefusedError('REPLAY_KIND_MISMATCH');
  }
  if (new Set(passages.map((passage) => passage.id)).size !== passages.length) {
    throw new PassageRefusedError('REPLAY_IDS_REPEATED');
  }
}

function ensureReplayedClosedAtIsPlausible(closedAt: Date, now: Date): void {
  ensureClosedAtIsPlausible(closedAt, now);
  if (now.getTime() - closedAt.getTime() > MAXIMUM_AGE_MILLISECONDS) {
    throw new PassageRefusedError('CLOSED_AT_TOO_OLD');
  }
}
