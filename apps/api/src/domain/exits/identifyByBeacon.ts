import type { AuthenticatedGate } from '../gates/AuthenticatedGate.ts';
import { ensureOwnGate } from '../gates/ownGate.ts';
import { PassageRefusedError } from '../gates/PassageRefusedError.ts';
import { openingWindowOf } from '../gates/OpeningWindow.ts';
import { payAndClose, type ExitDependencies, type ExitOutcome } from './exitParking.ts';

// Both signals must be this fresh, whichever comes first (Q34, step 2).
export const EXIT_BEACON_WINDOW_SECONDS = 60;
export const exitBeaconWindow = openingWindowOf(EXIT_BEACON_WINDOW_SECONDS);

export interface BeaconExitRequest {
  readonly lotId: string;
  // The lot's exit gate, the one that opens (one per lot, OQ12).
  readonly exitGateId: string | null;
  readonly now: Date;
}

// waiting: one signal is still missing; fallback: two drivers reported, so nothing opens and both use the tap; opened: the barrier was
// ordered open (the capture may be pending, decision 026); the others leave the driver to the tap.
export type BeaconExitOutcome =
  | { readonly outcome: 'waiting' | 'fallback' | 'opened' }
  | { readonly outcome: 'gate-unavailable' | 'payments-unavailable' | 'lot-busy' };

// Called when an app reports the exit beacon and when the console sees a vehicle: the exit happens on the second of the two, exactly as the
// tap does it (decision 029). The vehicle presence is spent by the exit, and by the ambiguity of two candidates, so one vehicle opens once.
export async function settleBeaconExit(dependencies: ExitDependencies, { lotId, exitGateId, now }: BeaconExitRequest): Promise<BeaconExitOutcome> {
  if (exitGateId === null) {
    return { outcome: 'gate-unavailable' };
  }
  const candidates = await dependencies.exits.findBeaconCandidates(lotId, exitBeaconWindow);
  const [session] = candidates;
  if (session === undefined || !(await dependencies.exits.takeVehiclePresence(exitGateId, exitBeaconWindow))) {
    return { outcome: 'waiting' };
  }
  if (candidates.length > 1) {
    return { outcome: 'fallback' };
  }
  return outcomeOf(await payAndClose(dependencies, session, { now, identification: 'BEACON', exitGateId }));
}

function outcomeOf(left: ExitOutcome): BeaconExitOutcome {
  switch (left.outcome) {
    case 'left':
    case 'already':
    case 'capture-pending':
      return { outcome: 'opened' };
    case 'gate-unavailable':
    case 'payments-unavailable':
    case 'lot-busy':
      return { outcome: left.outcome };
    default:
      return { outcome: 'waiting' };
  }
}

export interface BeaconReport {
  readonly sessionId: string;
  readonly driverId: string;
  // The beacon major the app heard: it must be the major of the session's own lot.
  readonly major: number;
  readonly now: Date;
}

export type BeaconReportRefusal = 'not-found' | 'entry-not-confirmed' | 'closed' | 'wrong-lot';

export type BeaconReportOutcome = BeaconExitOutcome | { readonly outcome: BeaconReportRefusal };

// The driver's own session only: another driver's session is not found, like an unknown id.
export async function reportExitBeacon(dependencies: ExitDependencies, report: BeaconReport): Promise<BeaconReportOutcome> {
  const session = await dependencies.exits.findForExit(report.sessionId, report.driverId);
  if (session === null) {
    return { outcome: 'not-found' };
  }
  if (session.state === 'CREATED') {
    return { outcome: 'entry-not-confirmed' };
  }
  if (session.state === 'CANCELLED' || session.state === 'CLOSED_PAID' || session.state === 'CLOSED_CAPTURE_PENDING') {
    return { outcome: 'closed' };
  }
  if (!(await dependencies.exits.recordBeaconReport(session.id, report.major))) {
    return { outcome: 'wrong-lot' };
  }
  return settleBeaconExit(dependencies, { lotId: session.lotId, exitGateId: session.exitGateId, now: report.now });
}

export interface VehiclePresence {
  // The gate whose device key signed the request.
  readonly gate: AuthenticatedGate;
  // The gate the request names in its path.
  readonly requestedGateId: string;
  readonly now: Date;
}

// The console saw a vehicle on the exit gate's arming loop; it opens the barrier when exactly one app reported the beacon.
export async function recordVehicleAtExit(dependencies: ExitDependencies, { gate, requestedGateId, now }: VehiclePresence): Promise<BeaconExitOutcome> {
  ensureOwnGate(gate, requestedGateId);
  if (gate.kind !== 'EXIT') {
    throw new PassageRefusedError('GATE_NOT_EXIT');
  }
  await dependencies.exits.recordVehiclePresence(gate.id);
  return settleBeaconExit(dependencies, { lotId: gate.lotId, exitGateId: gate.id, now });
}
