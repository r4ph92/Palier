import type { AssignedSpot, EntrySessionState } from '@palier/shared-types';
import type { PricingPolicy } from '../pricing/PricingPolicy.ts';
import type { VehicleNeeds } from '../vehicles/VehicleRepository.ts';

export interface SessionDraft {
  readonly driverId: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly needs: VehicleNeeds;
  readonly lotId: string;
  readonly entryGateId: string;
  readonly authorizedCents: number;
  readonly pricing: PricingPolicy;
}

export interface OpenedSession {
  readonly id: string;
  readonly spot: AssignedSpot;
}

// opened: a new session on a free spot; replayed: the driver's same entry, still opening, handed back (decideRepeatedScan).
export interface SessionOpening {
  readonly kind: 'opened' | 'replayed';
  readonly session: OpenedSession;
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
  // Under the lot lock, in one transaction: replays the driver's same entry still opening, or assigns the lot's first free
  // spot that fits the vehicle's needs and creates the session; null when no spot is free.
  // Throws EntryRefusedError NO_SUITABLE_SPOT when spots are free but none fits, ALREADY_INSIDE when the driver has
  // another active session, PAYMENTS_UNAVAILABLE when the lot stays locked too long.
  openWithFirstFreeSpot(draft: SessionDraft): Promise<SessionOpening | null>;
  // Records the hold on a CREATED or CANCELLED session, marking it for release when cancelled; throws for any other state or an unknown id.
  attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<HoldAttachment>;
  // The driver's own session only; null for an unknown id or another driver's session.
  findForUser(sessionId: string, userId: string): Promise<SessionStatus | null>;
  // Cancels a CREATED session and frees its spot in one transaction, marking its hold, if any, for release by the cancellation job.
  cancel(sessionId: string): Promise<void>;
}
