import type { GateKind } from '@palier/shared-types';
import type { ExitIdentification } from '@palier/shared-types/gateDraft';

// What the exit gate's reader reads: a plate, a transponder, or nothing (the operator has no reader).
export type ExitIdKind = 'ANPR' | 'RFID' | 'NONE';

// The dashboard says plate and transponder; the gate keeps the reader's technology (ANPR camera, RFID reader).
export const EXIT_IDENTIFICATION_OF = { NONE: 'NONE', ANPR: 'PLATE', RFID: 'TRANSPONDER' } as const satisfies Readonly<Record<ExitIdKind, ExitIdentification>>;
export const EXIT_ID_KIND_OF = { NONE: 'NONE', PLATE: 'ANPR', TRANSPONDER: 'RFID' } as const satisfies Readonly<Record<ExitIdentification, ExitIdKind>>;

export interface AuthenticatedGate {
  readonly id: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly name: string;
  readonly kind: GateKind;
  readonly hasLoops: boolean;
  readonly exitIdKind: ExitIdKind;
}
