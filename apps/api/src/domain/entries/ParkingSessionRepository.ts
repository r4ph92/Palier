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

export interface SessionStatus {
  readonly id: string;
  readonly state: EntrySessionState;
  readonly spot: AssignedSpot;
  readonly entryConfirmedAt: Date | null;
}

export interface ParkingSessionRepository {
  // Assigns the lot's first free spot that fits the vehicle's needs and creates the session in one transaction;
  // null when no spot is free. Throws EntryRefusedError NO_SUITABLE_SPOT when spots are free but none fits.
  // Throws EntryRefusedError ALREADY_INSIDE when the driver already has an active session.
  openWithFirstFreeSpot(draft: SessionDraft): Promise<OpenedSession | null>;
  attachPaymentIntent(sessionId: string, paymentIntentId: string): Promise<void>;
  // The driver's own session only; null for an unknown id or another driver's session.
  findForUser(sessionId: string, userId: string): Promise<SessionStatus | null>;
  // Cancels the session and frees its spot in one transaction.
  cancel(sessionId: string): Promise<void>;
}
