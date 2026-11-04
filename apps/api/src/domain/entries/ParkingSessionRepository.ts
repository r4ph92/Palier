import type { AssignedSpot, EntryStatusResponse } from '@palier/shared-types';

export interface SessionDraft {
  readonly driverId: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly lotId: string;
  readonly entryGateId: string;
  readonly authorizedCents: number;
}

export interface OpenedSession {
  readonly id: string;
  readonly spot: AssignedSpot;
}

export interface ParkingSessionRepository {
  // Assigns the lot's first free spot and creates the session in one transaction; null when no spot is free.
  // Throws EntryRefusedError ALREADY_INSIDE when the driver already has an active session.
  openWithFirstFreeSpot(draft: SessionDraft): Promise<OpenedSession | null>;
  attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<void>;
  // The driver's own session only; null for an unknown id or another driver's session.
  findForUser(sessionId: string, userId: string): Promise<EntryStatusResponse | null>;
  // Cancels the session and frees its spot in one transaction.
  cancel(sessionId: string): Promise<void>;
}
