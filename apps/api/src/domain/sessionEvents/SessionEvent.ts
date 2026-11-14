// 90 days counted in hours, so a purge date never moves with a daylight saving change (decision 035).
export const EVENT_RETENTION_HOURS = 2160;

export const SESSION_EVENT_KINDS = [
  'ENTRY_SCANNED',
  'GATE_OPENED',
  'ENTRY_LOOP_CLOSED',
  'AISLE_DETECTED',
  'PARKING_PRESUMED',
  'PARKING_CONFIRMED',
  'ENTRY_CANCELLED',
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

// Only entry openings are logged for now; the exit opening comes with #157.
export interface GateOpenedPayload {
  readonly direction: 'ENTRY';
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

// NO_LOOP: the cancellation job, opened telling whether a barrier command existed; ADMISSION_FAILED: the entry undone by its own request.
export type EntryCancelledPayload = { readonly reason: 'NO_LOOP'; readonly opened: boolean } | { readonly reason: 'ADMISSION_FAILED' };

export interface SessionEventPayloads {
  readonly ENTRY_SCANNED: EntryScannedPayload;
  readonly GATE_OPENED: GateOpenedPayload;
  readonly ENTRY_LOOP_CLOSED: EntryLoopClosedPayload;
  readonly AISLE_DETECTED: AisleDetectedPayload;
  readonly PARKING_PRESUMED: ParkingPresumedPayload;
  readonly PARKING_CONFIRMED: ParkingConfirmedPayload;
  readonly ENTRY_CANCELLED: EntryCancelledPayload;
}

// Each payload holds the facts of its step only: never an email, a card, a Stripe id or a user id.
export type SessionEvent = { readonly [K in SessionEventKind]: { readonly kind: K; readonly payload: SessionEventPayloads[K] } }[SessionEventKind];
