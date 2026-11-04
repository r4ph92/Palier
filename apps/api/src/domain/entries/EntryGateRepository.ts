import type { GateKind } from '@palier/shared-types';

export type GateIntegrationKind = 'DRY_CONTACT' | 'ACCESS_CONTROL_API' | 'SIMULATED';

export interface EntryGateLot {
  readonly id: string;
  readonly isOnline: boolean;
  readonly dailyCapCents: number;
  readonly operatorStripeAccountId: string | null;
}

export interface EntryGate {
  readonly id: string;
  readonly kind: GateKind;
  readonly integrationKind: GateIntegrationKind;
  readonly qrSecret: string | null;
  readonly lot: EntryGateLot;
}

export interface EntryGateRepository {
  findGate(gateId: string): Promise<EntryGate | null>;
}
