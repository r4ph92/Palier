import type { GateKind } from '@palier/shared-types';

export type GateIntegrationKind = 'DRY_CONTACT' | 'ACCESS_CONTROL_API' | 'SIMULATED';

export interface EntryGateLot {
  readonly id: string;
  readonly isOnline: boolean;
  readonly dailyCapCents: number;
  // The lot's jsonb policy as stored, read by parsePricingPolicy.
  readonly pricingPolicy: unknown;
  readonly capacity: number;
  readonly vehicleCount: number;
  readonly heldSpotCount: number;
  readonly operatorStripeAccountId: string | null;
}

export interface EntryGate {
  readonly id: string;
  readonly kind: GateKind;
  readonly integrationKind: GateIntegrationKind;
  readonly qrSecret: string | null;
  readonly lot: EntryGateLot;
}

export interface HoldQuery {
  readonly driverId: string;
  readonly lotId: string;
  readonly now: Date;
}

export interface EntryGateRepository {
  findGate(gateId: string): Promise<EntryGate | null>;
  // True when the driver has an active spot hold in this lot that has not reached its end at `now`.
  holdsRoomIn(query: HoldQuery): Promise<boolean>;
}
