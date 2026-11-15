import type { Refusal, StaleDataFollowUps } from '../api/followUpRefusal.ts';

// What the list last did, said once under its title: a success politely, a refusal with focus.
export type GateNotice =
  | { readonly kind: 'saved' | 'qrReplaced' | 'qrDownloaded'; readonly gateName: string }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

export interface ShownNotice {
  readonly notice: GateNotice | null;
  readonly key: number;
}

export function refusedNotice(refusal: Refusal): GateNotice {
  return { kind: 'refused', refusal };
}

// A gate that vanished is read again with the whole list, which then shows it gone.
export function gateStaleData(refresh: () => Promise<boolean>): StaleDataFollowUps {
  return { refreshOn: (code) => (code === 'GATE_NOT_FOUND' ? refresh() : null), reloadFailedCode: 'GATE_RELOAD_FAILED' };
}
