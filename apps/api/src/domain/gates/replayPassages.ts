import type { GateKind, PassageReplayResponse } from '@palier/shared-types';
import type { Clock } from '../time/Clock.ts';
import type { AuthenticatedGate } from './AuthenticatedGate.ts';
import { PassageRefusedError } from './PassageRefusedError.ts';
import { ensureClosedAtIsPlausible, ensureGateMayReport, vehicleCountChangeFor } from './passageRules.ts';
import type { PassageLedger, ReplayedPassage } from './PassageLedger.ts';

const MAXIMUM_REPLAY_AGE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

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

// Postgres reads uuids without regard to letter case, so ids are lowercased before the duplicate check and the ledger.
// Every passage is checked before any is written, so a refused batch counts nothing.
export async function replayPassages(command: ReplayCommand, collaborators: ReplayCollaborators): Promise<PassageReplayResponse> {
  const { gate, passages } = command;
  ensureGateMayReport(gate, command.requestedGateId);
  const identified = passages.map((passage) => ({ ...passage, id: passage.id.toLowerCase() }));
  ensureBatchIsConsistent(gate, identified);
  const now = collaborators.clock();
  identified.forEach((passage) => ensureReplayedClosedAtIsPlausible(passage.closedAt, now));
  return collaborators.ledger.recordReplay({
    gate,
    passages: identified.map(({ id, closedAt }) => ({ id, closedAt })),
    vehicleCountChange: vehicleCountChangeFor(gate.kind),
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
  if (now.getTime() - closedAt.getTime() > MAXIMUM_REPLAY_AGE_MILLISECONDS) {
    throw new PassageRefusedError('CLOSED_AT_TOO_OLD');
  }
}
