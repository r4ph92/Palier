import type { Refusal, StaleDataFollowUps } from '../api/followUpRefusal.ts';

// A change is said politely in the row of the gate it concerns; a refusal once, under the list's title, with focus.
export interface GateChange {
  readonly kind: 'saved' | 'qrReplaced' | 'qrDownloaded';
  readonly gateId: string;
  readonly gateName: string;
}

export type GateNotice = GateChange | { readonly kind: 'refused'; readonly refusal: Refusal };

export interface ShownNotice {
  readonly notice: GateNotice | null;
  readonly key: number;
}

export function refusedNotice(refusal: Refusal): GateNotice {
  return { kind: 'refused', refusal };
}

// The change this gate's row says, if the last notice concerns it.
export function changeOfGate({ notice }: ShownNotice, gateId: string): GateChange | null {
  return notice !== null && notice.kind !== 'refused' && notice.gateId === gateId ? notice : null;
}

// A gate that vanished is read again with the whole list, which then shows it gone.
export function gateStaleData(refresh: () => Promise<boolean>): StaleDataFollowUps {
  return { refreshOn: (code) => (code === 'GATE_NOT_FOUND' ? refresh() : null), reloadFailedCode: 'GATE_RELOAD_FAILED' };
}
