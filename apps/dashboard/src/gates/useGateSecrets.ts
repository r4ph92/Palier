import type { DashboardGate, GateDeviceKey } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { followUpRefusal, type StaleDataFollowUps } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import { refusedNotice, type GateNotice } from './gateNotice.ts';

export type SecretKind = 'deviceKey' | 'qrSecret';

// Where focus returns once a question closes: the button that asked, or the print button once a new QR secret is saved.
export type FocusReturn = SecretKind | 'print';

export interface ShownKey extends GateDeviceKey {
  readonly gateName: string;
}

export interface GateSecretTarget {
  readonly lotId: string;
  readonly lotName: string;
  readonly gate: DashboardGate;
  readonly onKey: (shown: ShownKey) => void;
  readonly onNotice: (notice: GateNotice) => void;
  readonly staleData: StaleDataFollowUps;
}

export interface GateSecrets {
  readonly confirming: SecretKind | null;
  readonly refocus: FocusReturn | null;
  readonly busy: boolean;
  readonly ask: (kind: SecretKind) => void;
  readonly cancel: () => void;
  readonly confirm: () => Promise<void>;
  readonly print: () => Promise<void>;
}

// One request at a time per gate, for both regenerations and the print: a late answer never shows a key already replaced.
export function useGateSecrets(target: GateSecretTarget): GateSecrets {
  const request = useGuardedRequest();
  const { confirming, refocus, ask, cancel, answered } = useSecretQuestion();
  const actions = useSecretActions(target);
  const confirm = () => (confirming === null ? Promise.resolve() : request.run(() => answered(actions.replace(confirming))));
  return { confirming, refocus, busy: request.busy, ask, cancel, confirm, print: () => request.run(actions.print) };
}

// Which regeneration is being asked about, and where focus returns once the question closes.
function useSecretQuestion() {
  const [confirming, setConfirming] = useState<SecretKind | null>(null);
  const [refocus, setRefocus] = useState<FocusReturn | null>(null);
  const ask = (kind: SecretKind) => {
    setRefocus(null);
    setConfirming(kind);
  };
  const cancel = () => {
    setRefocus(confirming);
    setConfirming(null);
  };
  const answered = async (replaced: Promise<FocusReturn | null>) => {
    try {
      setRefocus(await replaced);
    } finally {
      setConfirming(null);
    }
  };
  return { confirming, refocus, ask, cancel, answered };
}

function useSecretActions(target: GateSecretTarget) {
  const refreshSession = useSessionRefresh();
  const refuse = async (failure: unknown) => target.onNotice(refusedNotice(await followUpRefusal(failure, { refreshSession, ...target.staleData })));
  const refuseReplacement = async (failure: unknown) => {
    await refuse(failure);
    return null;
  };
  return { replace: (kind: SecretKind) => replaceSecret(target, kind).catch(refuseReplacement), print: () => printQr(target).catch(refuse) };
}

// The new key's panel and a refusal each take focus themselves; after a new QR secret, the next step is printing it.
async function replaceSecret({ lotId, gate, onKey, onNotice }: GateSecretTarget, kind: SecretKind): Promise<FocusReturn | null> {
  if (kind === 'deviceKey') {
    onKey({ ...(await dashboardClient.replaceDeviceKey(lotId, gate.id)), gateName: gate.name });
    return null;
  }
  await dashboardClient.replaceQrSecret(lotId, gate.id);
  onNotice({ kind: 'qrReplaced', gateId: gate.id, gateName: gate.name });
  return 'print';
}

async function printQr({ lotId, lotName, gate, onNotice }: GateSecretTarget): Promise<void> {
  const { link } = await dashboardClient.gateQrLink(lotId, gate.id);
  // Loaded at the first print: the sheet carries its own fonts, which the page never needs.
  const { downloadQrSheet } = await import('./downloadQrSheet.ts');
  downloadQrSheet({ lotName, gateName: gate.name, kind: gate.kind, link });
  onNotice({ kind: 'qrDownloaded', gateId: gate.id, gateName: gate.name });
}
