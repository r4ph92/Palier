import type { ActiveEntrySessionState, AssignedSpot } from '@palier/shared-types';
import { EntryRefusedError } from './EntryRefusedError.ts';
import type { OpenedSession, SessionOpening } from './ParkingSessionRepository.ts';

export interface ActiveSessionFacts {
  readonly id: string;
  readonly lotId: string;
  readonly entryGateId: string;
  readonly state: ActiveEntrySessionState;
  readonly isWithinOpeningWindow: boolean;
  readonly spot: AssignedSpot;
}

export interface ScannedEntryGate {
  readonly lotId: string;
  readonly entryGateId: string;
}

export type RepeatedScanDecision =
  | { readonly kind: 'open' }
  | { readonly kind: 'replay'; readonly session: OpenedSession }
  | { readonly kind: 'refuse' };

// A re-scan of the same gate while that entry is still opening (a double tap, an app timeout) gets the same entry back.
export function decideRepeatedScan(active: ActiveSessionFacts | null, scan: ScannedEntryGate): RepeatedScanDecision {
  if (active === null) {
    return { kind: 'open' };
  }
  if (isSameOpeningEntry(active, scan)) {
    return { kind: 'replay', session: { id: active.id, spot: active.spot } };
  }
  return { kind: 'refuse' };
}

function isSameOpeningEntry(active: ActiveSessionFacts, scan: ScannedEntryGate): boolean {
  return active.lotId === scan.lotId && active.entryGateId === scan.entryGateId && active.state === 'CREATED' && active.isWithinOpeningWindow;
}

// What the decision leads to; openNew assigns a spot and creates the session, null when no spot is free.
export async function openingFor(decision: RepeatedScanDecision, openNew: () => Promise<OpenedSession | null>): Promise<SessionOpening | null> {
  if (decision.kind === 'refuse') {
    throw new EntryRefusedError('ALREADY_INSIDE');
  }
  if (decision.kind === 'replay') {
    return { kind: 'replayed', session: decision.session };
  }
  const session = await openNew();
  return session === null ? null : { kind: 'opened', session };
}
