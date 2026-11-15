import type { DashboardSessionRow, DashboardSessionSummary, ParkingEvidence } from '@palier/shared-types/sessionTimeline';
import type { SessionRecord } from './SessionTimelineRepository.ts';

// The same sums as the receipt the driver saw (receiptOf) and as the pending capture the retry takes (decision 026); a session still inside owes nothing yet.
export function amountOf(session: SessionRecord): number | null {
  if (session.state === 'CLOSED_PAID') {
    return (session.capturedCents ?? 0) + session.surplusPaidCents;
  }
  return session.state === 'CLOSED_CAPTURE_PENDING' ? (session.pendingCaptureCents ?? 0) + session.pendingSurplusCents : null;
}

// Answered wins over the presumption it replaced, which presumed_by keeps as history.
export function parkingEvidenceOf(session: SessionRecord): ParkingEvidence | null {
  if (session.wasAnswered) {
    return 'ANSWERED';
  }
  if (session.presumedBy === null) {
    return null;
  }
  return session.presumedBy === 'WALK' ? 'ON_FOOT' : 'TIMEOUT';
}

// A spot the driver never walked away from is not yet a real spot: the assigned one is only the plan.
export function realSpotNumberOf(session: SessionRecord): string | null {
  if (session.confirmedSpotNumber !== null) {
    return session.confirmedSpotNumber;
  }
  return session.presumedBy === null ? null : session.assignedSpotNumber;
}

export function sessionRowOf(session: SessionRecord): DashboardSessionRow {
  return {
    id: session.id,
    plate: session.plate,
    state: session.state,
    entryAt: session.enteredAt.toISOString(),
    exitAt: session.exitedAt?.toISOString() ?? null,
    assignedSpotNumber: session.assignedSpotNumber,
    amountCents: amountOf(session),
  };
}

export function sessionSummaryOf(session: SessionRecord): DashboardSessionSummary {
  return {
    plate: session.plate,
    state: session.state,
    assignedSpotNumber: session.assignedSpotNumber,
    realSpotNumber: realSpotNumberOf(session),
    parkingEvidence: parkingEvidenceOf(session),
    exitMethod: session.exitMethod,
    amountCents: amountOf(session),
    unpaidCents: session.unpaidCents,
    entryAt: session.enteredAt.toISOString(),
    exitAt: session.exitedAt?.toISOString() ?? null,
  };
}
