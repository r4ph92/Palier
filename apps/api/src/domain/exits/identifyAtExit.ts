import type { AuthenticatedGate } from '../gates/AuthenticatedGate.ts';
import { PassageRefusedError } from '../gates/PassageRefusedError.ts';
import { readPlate, readTransponder } from '../vehicles/plate.ts';
import { payAndClose, type ExitDependencies, type ExitOutcome } from './exitParking.ts';
import type { ExitIdentification, ReadIdentifierKind } from './ExitRepository.ts';

export interface IdentifyRequest {
  // The gate whose device key signed the request.
  readonly gate: AuthenticatedGate;
  // The gate the request names in its path.
  readonly requestedGateId: string;
  readonly identifier: string;
  readonly now: Date;
}

// opened: the barrier was ordered open (the capture may still be pending, decision 026); fallback: no single session was found, so
// nothing was taken and the driver opens with the app.
export type IdentifyOutcome =
  | { readonly outcome: 'opened'; readonly identification: 'plate' | 'transponder' }
  | { readonly outcome: 'fallback' | 'gate-unavailable' | 'payments-unavailable' | 'lot-busy' };

const KIND_BY_READER = { ANPR: 'PLATE', RFID: 'TRANSPONDER' } as const;

interface ReadKey {
  readonly kind: ReadIdentifierKind;
  readonly key: string;
}

// The exit reader read a plate or a transponder: leave exactly as the "Ouvrir" tap does, if one open session has it (decision 028).
// Anything uncertain (no session, two sessions) opens nothing and takes nothing.
export async function identifyAtExit(dependencies: ExitDependencies, request: IdentifyRequest): Promise<IdentifyOutcome> {
  const { gate, now } = request;
  const read = readerKeyOf(request);
  const sessions = await dependencies.exits.findLeavableByIdentifier(gate.lotId, read.kind, read.key);
  const [session] = sessions;
  if (session === undefined || sessions.length > 1) {
    return { outcome: 'fallback' };
  }
  const identification: ExitIdentification = read.kind;
  return outcomeOf(await payAndClose(dependencies, session, { now, identification, exitGateId: gate.id }), read.kind);
}

// A capture that stays pending still opened the barrier (decision 026).
function outcomeOf(left: ExitOutcome, kind: ReadIdentifierKind): IdentifyOutcome {
  switch (left.outcome) {
    case 'left':
    case 'already':
    case 'capture-pending':
      return { outcome: 'opened', identification: kind === 'PLATE' ? 'plate' : 'transponder' };
    case 'gate-unavailable':
    case 'payments-unavailable':
    case 'lot-busy':
      return { outcome: left.outcome };
    default:
      return { outcome: 'fallback' };
  }
}

// The gate must be the one of the device key and read something; the identifier must be one the reader could have read.
function readerKeyOf({ gate, requestedGateId, identifier }: IdentifyRequest): ReadKey {
  if (gate.id !== requestedGateId) {
    throw new PassageRefusedError('GATE_FORBIDDEN');
  }
  if (gate.kind !== 'EXIT' || gate.exitIdKind === 'NONE') {
    throw new PassageRefusedError('GATE_WITHOUT_READER');
  }
  const kind = KIND_BY_READER[gate.exitIdKind];
  const key = kind === 'PLATE' ? readPlate(identifier)?.plateKey : readTransponder(identifier)?.transponderKey;
  if (key === undefined) {
    throw new PassageRefusedError('IDENTIFIER_INVALID');
  }
  return { kind, key };
}
