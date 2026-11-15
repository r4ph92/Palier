import type { EntrySessionState } from '@palier/shared-types';
import type { SessionExitMethod } from '@palier/shared-types/sessionTimeline';
import type { SessionRecord, StoredSessionEvent } from '../../domain/dashboard/SessionTimelineRepository.ts';
import type { PresumptionEvidence } from '../../domain/parkingSessions/PresumptionEvidence.ts';

export interface SessionRow extends Record<string, unknown> {
  readonly id: string;
  readonly plate: string;
  readonly state: EntrySessionState;
  readonly entry_scan_at: Date | string;
  readonly exit_at: Date | string | null;
  readonly assigned_spot_number: string;
  readonly confirmed_spot_number: string | null;
  readonly presumed_by: PresumptionEvidence | null;
  readonly was_answered: boolean;
  readonly exit_identification: SessionExitMethod | null;
  readonly captured_cents: number | null;
  readonly surplus_paid_cents: number;
  readonly pending_capture_cents: number | null;
  readonly pending_surplus_cents: number;
  readonly unpaid_cents: number;
}

export interface SessionEventRow extends Record<string, unknown> {
  // A bigint identity: the driver hands it over as text.
  readonly sequence: number | string;
  readonly kind: string;
  readonly payload: unknown;
  readonly occurred_at: Date | string;
}

export function sessionRecordOf(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    plate: row.plate,
    state: row.state,
    enteredAt: new Date(row.entry_scan_at),
    exitedAt: row.exit_at === null ? null : new Date(row.exit_at),
    assignedSpotNumber: row.assigned_spot_number,
    confirmedSpotNumber: row.confirmed_spot_number,
    presumedBy: row.presumed_by,
    wasAnswered: row.was_answered,
    exitMethod: row.exit_identification,
    capturedCents: row.captured_cents,
    surplusPaidCents: row.surplus_paid_cents,
    pendingCaptureCents: row.pending_capture_cents,
    pendingSurplusCents: row.pending_surplus_cents,
    unpaidCents: row.unpaid_cents,
  };
}

export function storedEventOf(row: SessionEventRow): StoredSessionEvent {
  return { sequence: Number(row.sequence), kind: row.kind, occurredAt: new Date(row.occurred_at), payload: row.payload };
}
