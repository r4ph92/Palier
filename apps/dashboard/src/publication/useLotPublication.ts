import type { LotPublication } from '@palier/shared-types';
import { useCallback, useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { usePolledLotResource } from '../api/usePolledLotResource.ts';
import type { PolledResource } from '../api/usePolledResource.ts';

export interface LotPublicationView {
  readonly resource: PolledResource<LotPublication>;
  // What a write answered: shown until the next poll brings a newer checklist.
  readonly show: (publication: LotPublication) => void;
  // Reads the checklist again after a refusal that says it changed; false when that read failed too.
  readonly refresh: () => Promise<boolean>;
}

interface Written {
  readonly publication: LotPublication;
  readonly over: LotPublication | null;
}

// Polled, so a gate's test passage shows within 30 s; the attestation forms keep what the operator typed, as they read the checklist only once.
export function useLotPublication(lotId: string): LotPublicationView {
  const load = useCallback(() => dashboardClient.lotPublication(lotId), [lotId]);
  const polled = usePolledLotResource(load);
  const [written, setWritten] = useState<Written | null>(null);
  const polledValue = polled.status === 'ready' ? polled.value : null;
  const show = (publication: LotPublication) => setWritten({ publication, over: polledValue });
  const refresh = async (): Promise<boolean> => {
    try {
      show(await load());
      return true;
    } catch {
      return false;
    }
  };
  return { resource: withWritten(polled, written), show, refresh };
}

function withWritten(polled: PolledResource<LotPublication>, written: Written | null): PolledResource<LotPublication> {
  if (polled.status !== 'ready' || written === null || written.over !== polled.value) {
    return polled;
  }
  return { ...polled, value: written.publication };
}
