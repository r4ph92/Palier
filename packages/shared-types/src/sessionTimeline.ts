import type { EntrySessionState } from './entries.ts';

export const SESSION_LIST_STATUSES = ['OPEN', 'ALL'] as const;
export type SessionListStatus = (typeof SESSION_LIST_STATUSES)[number];

export const SESSION_LIST_PAGE_SIZE = 50;

export const SESSION_EXIT_METHODS = ['APP', 'PLATE', 'TRANSPONDER', 'BEACON'] as const;
export type SessionExitMethod = (typeof SESSION_EXIT_METHODS)[number];

export const PARKING_EVIDENCES = ['ON_FOOT', 'TIMEOUT', 'ANSWERED'] as const;
export type ParkingEvidence = (typeof PARKING_EVIDENCES)[number];

// Every kind of the event log, plus the one a newer API may write before this dashboard knows it.
export const TIMELINE_KINDS = [
  'ENTRY_SCANNED',
  'GATE_OPENED',
  'ENTRY_LOOP_CLOSED',
  'AISLE_DETECTED',
  'PARKING_PRESUMED',
  'PARKING_CONFIRMED',
  'ENTRY_CANCELLED',
  'EXIT_IDENTIFIED',
  'CAPTURED',
  'CAPTURE_PENDING',
  'EXIT_LOOP_CLOSED',
  'UNKNOWN',
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const GATE_DIRECTIONS = ['ENTRY', 'EXIT'] as const;
export type GateDirection = (typeof GATE_DIRECTIONS)[number];

export const CANCELLATION_REASONS = ['NO_LOOP', 'ADMISSION_FAILED'] as const;

// The few facts a step shows, picked one by one from its payload: never the raw payload, never an id.
export interface TimelineDetails {
  readonly direction?: GateDirection;
  readonly spotNumber?: string;
  readonly aisleCode?: string;
  readonly isAssignedAisle?: boolean;
  readonly evidence?: Exclude<ParkingEvidence, 'ANSWERED'>;
  readonly method?: SessionExitMethod;
  readonly reason?: (typeof CANCELLATION_REASONS)[number];
  readonly amountCents?: number;
  readonly unpaidCents?: number;
}

export interface TimelineEntry {
  // The rank of the step in its session, from 1.
  readonly step: number;
  readonly kind: TimelineKind;
  readonly occurredAt: string;
  readonly details: TimelineDetails;
}

export interface DashboardSessionRow {
  readonly id: string;
  readonly plate: string;
  readonly state: EntrySessionState;
  readonly entryAt: string;
  readonly exitAt: string | null;
  readonly assignedSpotNumber: string;
  readonly amountCents: number | null;
}

export interface DashboardSessionList {
  readonly lotName: string;
  readonly sessions: readonly DashboardSessionRow[];
  // The id of the last row when older sessions exist, to pass as `before`; null on the last page.
  readonly nextCursor: string | null;
}

export interface DashboardSessionSummary {
  readonly plate: string;
  readonly state: EntrySessionState;
  readonly assignedSpotNumber: string;
  readonly realSpotNumber: string | null;
  readonly parkingEvidence: ParkingEvidence | null;
  readonly exitMethod: SessionExitMethod | null;
  readonly amountCents: number | null;
  readonly unpaidCents: number;
  readonly entryAt: string;
  readonly exitAt: string | null;
}

export interface DashboardSessionDetail {
  readonly lotName: string;
  readonly summary: DashboardSessionSummary;
  readonly timeline: readonly TimelineEntry[];
}
