import type { ExitIdentification } from '../exits/ExitRepository.ts';

// 90 days counted in hours, so a purge date never moves with a daylight saving change (decision 037).
export const EVENT_RETENTION_HOURS = 2160;

export const SESSION_EVENT_KINDS = [
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
] as const;

export type SessionEventKind = (typeof SESSION_EVENT_KINDS)[number];

export interface EntryScannedPayload {
  readonly plate: string;
  readonly gateId: string;
  readonly spotId: string;
  readonly spotNumber: string;
  readonly aisleCode: string;
  readonly levelCode: string;
}

export interface GateOpenedPayload {
  readonly direction: 'ENTRY' | 'EXIT';
  readonly gateId: string;
  readonly commandId: string;
}

export interface EntryLoopClosedPayload {
  readonly gateId: string;
}

export interface AisleDetectedPayload {
  readonly aisleId: string;
  readonly aisleCode: string;
  readonly beaconMinor: number;
  readonly isAssignedAisle: boolean;
}

export interface ParkingPresumedPayload {
  readonly evidence: 'ON_FOOT' | 'TIMEOUT';
  readonly spotId: string;
  readonly spotNumber: string;
}

export interface ParkingConfirmedPayload {
  readonly spotId: string;
  readonly spotNumber: string;
}

// The cancellation job's: wasBarrierOpened tells whether a barrier command existed for the session.
export interface EntryWithoutLoopPayload {
  readonly reason: 'NO_LOOP';
  readonly wasBarrierOpened: boolean;
}

// ADMISSION_FAILED: the entry undone by its own request.
export type EntryCancelledPayload = EntryWithoutLoopPayload | { readonly reason: 'ADMISSION_FAILED' };

// How the vehicle was recognised at the exit gate: never the plate or the transponder read.
export interface ExitIdentifiedPayload {
  readonly method: ExitIdentification;
  readonly gateId: string;
}

// What Stripe took on the hold, and for a stay over 24 hours what the card paid and refused beyond it (decision 027).
export interface CapturedPayload {
  readonly capturedCents: number;
  readonly surplusPaidCents: number;
  readonly unpaidCents: number;
}

// The amounts fixed at the exit when Stripe could not be reached; the retry takes exactly them (decision 026).
export interface CapturePendingPayload {
  readonly pendingCaptureCents: number;
  readonly pendingSurplusCents: number;
}

export interface ExitLoopClosedPayload {
  readonly gateId: string;
}

export interface SessionEventPayloads {
  readonly ENTRY_SCANNED: EntryScannedPayload;
  readonly GATE_OPENED: GateOpenedPayload;
  readonly ENTRY_LOOP_CLOSED: EntryLoopClosedPayload;
  readonly AISLE_DETECTED: AisleDetectedPayload;
  readonly PARKING_PRESUMED: ParkingPresumedPayload;
  readonly PARKING_CONFIRMED: ParkingConfirmedPayload;
  readonly ENTRY_CANCELLED: EntryCancelledPayload;
  readonly EXIT_IDENTIFIED: ExitIdentifiedPayload;
  readonly CAPTURED: CapturedPayload;
  readonly CAPTURE_PENDING: CapturePendingPayload;
  readonly EXIT_LOOP_CLOSED: ExitLoopClosedPayload;
}

// Each payload holds the facts of its step only: never an email, a card, a Stripe id or a user id.
export type SessionEvent = { readonly [K in SessionEventKind]: { readonly kind: K; readonly payload: SessionEventPayloads[K] } }[SessionEventKind];
