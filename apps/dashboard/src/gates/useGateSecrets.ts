import type { DashboardGate, GateDeviceKey } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { followUpRefusal, type StaleDataFollowUps } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import { downloadQrSheet } from './downloadQrSheet.ts';
import { refusedNotice, type GateNotice } from './gateNotice.ts';

export type SecretKind = 'deviceKey' | 'qrSecret';

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
  readonly cancelled: SecretKind | null;
  readonly busy: boolean;
  readonly ask: (kind: SecretKind) => void;
  readonly cancel: () => void;
  readonly confirm: () => Promise<void>;
  readonly print: () => Promise<void>;
}

// One request at a time per gate, for both regenerations and the print: a late answer never shows a key already replaced.
export function useGateSecrets(target: GateSecretTarget): GateSecrets {
  const request = useGuardedRequest();
  const [confirming, setConfirming] = useState<SecretKind | null>(null);
  const [cancelled, setCancelled] = useState<SecretKind | null>(null);
  const actions = useSecretActions(target);
  const ask = (kind: SecretKind) => {
    setCancelled(null);
    setConfirming(kind);
  };
  const cancel = () => {
    setCancelled(confirming);
    setConfirming(null);
  };
  const confirm = () => (confirming === null ? Promise.resolve() : request.run(() => actions.replace(confirming).finally(() => setConfirming(null))));
  return { confirming, cancelled, busy: request.busy, ask, cancel, confirm, print: () => request.run(actions.print) };
}

function useSecretActions({ lotId, lotName, gate, onKey, onNotice, staleData }: GateSecretTarget) {
  const refreshSession = useSessionRefresh();
  const refuse = async (failure: unknown) => onNotice(refusedNotice(await followUpRefusal(failure, { refreshSession, ...staleData })));
  const replaceNamed = async (kind: SecretKind) => {
    if (kind === 'deviceKey') {
      onKey({ ...(await dashboardClient.replaceDeviceKey(lotId, gate.id)), gateName: gate.name });
      return;
    }
    await dashboardClient.replaceQrSecret(lotId, gate.id);
    onNotice({ kind: 'qrReplaced', gateName: gate.name });
  };
  const print = async () => {
    const { link } = await dashboardClient.gateQrLink(lotId, gate.id);
    downloadQrSheet({ lotName, gateName: gate.name, kind: gate.kind, link });
    onNotice({ kind: 'qrDownloaded', gateName: gate.name });
  };
  return { replace: (kind: SecretKind) => replaceNamed(kind).catch(refuse), print: () => print().catch(refuse) };
}
