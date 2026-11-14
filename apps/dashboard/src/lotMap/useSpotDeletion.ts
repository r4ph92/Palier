import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { followUpRefusal, type Refusal, type RefusalFollowUps } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';

export interface SpotDeletionTarget {
  readonly lotId: string;
  readonly onDeleted: (spots: DashboardAisleSpots, spot: DashboardSpot) => void;
  readonly onRefused: (refusal: Refusal) => void;
  readonly staleData: Omit<RefusalFollowUps, 'refreshSession'>;
}

export interface SpotDeletion {
  // The spot whose row asks to confirm; null when no row does.
  readonly confirming: DashboardSpot | null;
  readonly ask: (spot: DashboardSpot) => void;
  // Closes the question; the row's delete button then takes focus back.
  readonly cancel: () => void;
  readonly cancelledId: string | null;
  readonly deleting: boolean;
  readonly confirm: () => Promise<void>;
}

// A refused delete leaves the spot in the list and says why, naming the spot; the list shows only what the API answered.
export function useSpotDeletion(target: SpotDeletionTarget): SpotDeletion {
  const request = useGuardedRequest();
  const [confirming, setConfirming] = useState<DashboardSpot | null>(null);
  const [cancelledId, setCancelledId] = useState<string | null>(null);
  const remove = useSpotRemoval(target);
  const ask = (spot: DashboardSpot) => {
    setCancelledId(null);
    setConfirming(spot);
  };
  const cancel = () => {
    setCancelledId(confirming?.id ?? null);
    setConfirming(null);
  };
  const confirm = () => (confirming === null ? Promise.resolve() : request.run(() => remove(confirming).finally(() => setConfirming(null))));
  return { confirming, ask, cancel, cancelledId, deleting: request.busy, confirm };
}

function useSpotRemoval({ lotId, onDeleted, onRefused, staleData }: SpotDeletionTarget) {
  const refreshSession = useSessionRefresh();
  return async (spot: DashboardSpot) => {
    try {
      onDeleted(await dashboardClient.deleteSpot(lotId, spot.id), spot);
    } catch (failure) {
      const { code, values } = await followUpRefusal(failure, { refreshSession, ...staleData });
      onRefused({ code, values: { number: spot.number, ...values } });
    }
  };
}
