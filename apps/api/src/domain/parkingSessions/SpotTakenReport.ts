import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import type { SpotState } from '../spots/spotStates.ts';

// spotNumber: the spot the driver found taken, trimmed; it must still be the session's assigned spot.
export interface SpotTakenReport {
  readonly sessionId: string;
  readonly driverId: string;
  readonly spotNumber: string;
}

export type SpotTakenRefusal = 'not-found' | 'entry-not-confirmed' | 'already-parked' | 'closed' | 'spot-not-assigned' | 'lot-busy';

// reassigned: another fitting spot became the session's; none-free: the driver is asked where they parked (decision 022).
export type SpotTakenOutcome =
  | { readonly outcome: 'reassigned'; readonly spot: AssignedSpot }
  | { readonly outcome: 'none-free' }
  | { readonly outcome: SpotTakenRefusal };

export interface SpotTakenReportRepository {
  // The driver's own session only: another driver's session is not found, like an unknown id.
  report(report: SpotTakenReport): Promise<SpotTakenOutcome>;
}

type SessionRefusal = Extract<SpotTakenRefusal, 'entry-not-confirmed' | 'already-parked' | 'closed'>;

// Only a driver through the gate who has not parked yet can find the spot taken; once parked, the spot answer corrects it.
const SESSION_REFUSALS: Readonly<Record<EntrySessionState, SessionRefusal | null>> = {
  CREATED: 'entry-not-confirmed',
  ENTRY_CONFIRMED: null,
  PARKED_PRESUMED: 'already-parked',
  PARKED_UNCONFIRMED: 'already-parked',
  PARKED_CONFIRMED: 'already-parked',
  CANCELLED: 'closed',
  CLOSED_PAID: 'closed',
  CLOSED_CAPTURE_PENDING: 'closed',
};

export interface ReportFacts {
  readonly sessionState: EntrySessionState;
  readonly assignedSpot: { readonly number: string; readonly state: SpotState };
  readonly reportedNumber: string;
}

// flagsReported: the spot is OCCUPIED_UNKNOWN to check only when it was still OCCUPIED for the driver; an operator may have
// moved it meanwhile, and the driver gets another spot anyway (as in decision 021).
export type ReportPlan =
  | { readonly outcome: 'refused'; readonly refusal: SessionRefusal | 'spot-not-assigned' }
  | { readonly outcome: 'report'; readonly flagsReported: boolean };

export function reportPlanOf({ sessionState, assignedSpot, reportedNumber }: ReportFacts): ReportPlan {
  const sessionRefusal = SESSION_REFUSALS[sessionState];
  if (sessionRefusal !== null) {
    return { outcome: 'refused', refusal: sessionRefusal };
  }
  if (canonicalSpotNumber(reportedNumber) !== canonicalSpotNumber(assignedSpot.number)) {
    return { outcome: 'refused', refusal: 'spot-not-assigned' };
  }
  return { outcome: 'report', flagsReported: assignedSpot.state === 'OCCUPIED' };
}
