import type { GateKind } from '@palier/shared-types';

export interface AuthenticatedGate {
  readonly id: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly hasLoops: boolean;
}
