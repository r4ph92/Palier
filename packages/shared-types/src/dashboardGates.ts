import type { ExitIdentification, GateIntegrationKind } from './gateDraft.ts';
import type { GateKind } from './gates.ts';

// A gate as the operator configures it; its device key and QR secret are never read back.
export interface DashboardGate {
  readonly id: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly integrationKind: GateIntegrationKind;
  readonly endpoint: string | null;
  readonly reportsLoops: boolean;
  readonly exitIdentification: ExitIdentification;
}

// Entry gates first, then by name.
export interface DashboardLotGates {
  readonly lotId: string;
  readonly lotName: string;
  readonly gates: readonly DashboardGate[];
}

// The only time a device key leaves the API: the controller's copy is the one place it lives in clear (decision 006).
export interface GateDeviceKey {
  readonly gateId: string;
  readonly deviceKey: string;
}

export interface CreatedGate extends GateDeviceKey {
  readonly lotGates: DashboardLotGates;
}

// The link the gate's printed QR holds, signed with its secret; the secret itself stays in the API.
export interface GateQrLink {
  readonly link: string;
}
