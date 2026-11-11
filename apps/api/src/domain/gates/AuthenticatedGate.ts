import type { GateKind } from '@palier/shared-types';

// What the exit gate's reader reads: a plate, a transponder, or nothing (the operator has no reader).
export type ExitIdKind = 'ANPR' | 'RFID' | 'NONE';

export interface AuthenticatedGate {
  readonly id: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly hasLoops: boolean;
  readonly exitIdKind: ExitIdKind;
}
