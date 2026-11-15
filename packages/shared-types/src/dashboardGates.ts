import type { ExitIdentification, GateIntegrationKind } from './gateDraft.ts';
import type { GateKind } from './gates.ts';

export const GATE_ERROR_CODES = [
  'GATE_NOT_FOUND',
  'GATE_NAME_REQUIRED',
  'GATE_NAME_INVALID',
  'GATE_NAME_TAKEN',
  'GATE_ENDPOINT_NOT_HTTPS',
  'GATE_ENDPOINT_REQUIRED',
  'GATE_EXIT_ID_ON_ENTRY',
  'GATE_EXIT_LIMIT',
  'GATE_LIMIT_REACHED',
] as const;

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
  // Null when the list could not be read after the commit: the key is still answered, and the page reads the list again.
  readonly lotGates: DashboardLotGates | null;
}

// The link the gate's printed QR holds, signed with its secret; the secret itself stays in the API.
export interface GateQrLink {
  readonly link: string;
}
