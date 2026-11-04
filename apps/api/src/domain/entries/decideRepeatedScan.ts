import type { ActiveEntrySessionState, AssignedSpot } from '@palier/shared-types';
import type { OpenedSession } from './ParkingSessionRepository.ts';

// What the repository reads, under the lot lock, about the driver's active session, whatever its lot.
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

// A second scan of the same entry gate while that entry is still opening is the same entry (a double tap, a re-scan
// after the app gave up): the driver gets it back. Any other scan from a driver with an active session is ALREADY_INSIDE.
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
