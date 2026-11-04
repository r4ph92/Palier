import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import type { PricingPolicy } from '../pricing/PricingPolicy.ts';

export interface SessionDraft {
  readonly driverId: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly lotId: string;
  readonly entryGateId: string;
  readonly authorizedCents: number;
  readonly pricing: PricingPolicy;
}

export interface OpenedSession {
  readonly id: string;
  readonly spot: AssignedSpot;
}

export interface SessionStatus {
  readonly id: string;
  readonly state: EntrySessionState;
  readonly spot: AssignedSpot;
  readonly entryConfirmedAt: Date | null;
}

// cancelled: the cancellation job got to the session before its hold was recorded.
export type HoldAttachment = 'attached' | 'cancelled';

export interface ParkingSessionRepository {
  // Assigns the lot's first free spot and creates the session in one transaction; null when no spot is free.
  // Throws EntryRefusedError ALREADY_INSIDE when the driver already has an active session.
  openWithFirstFreeSpot(draft: SessionDraft): Promise<OpenedSession | null>;
  // Records the hold on a CREATED or CANCELLED session, marking it for release when cancelled; throws for any other state or an unknown id.
  attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<HoldAttachment>;
  // The driver's own session only; null for an unknown id or another driver's session.
  findForUser(sessionId: string, userId: string): Promise<SessionStatus | null>;
  // Cancels a CREATED session and frees its spot in one transaction, marking its hold, if any, for release by the cancellation job.
  cancel(sessionId: string): Promise<void>;
}
