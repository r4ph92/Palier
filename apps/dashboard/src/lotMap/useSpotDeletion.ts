import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { asDashboardApiError, endsSession, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import type { SpotRefusalFollowUp } from './spotRefusal.ts';

export interface SpotDeletionTarget {
  readonly lotId: string;
  readonly onDeleted: (spots: DashboardAisleSpots, spot: DashboardSpot) => void;
  readonly onRefused: SpotRefusalFollowUp;
}

export interface SpotDeletion {
  // The spot whose row asks to confirm; null when no row does.
  readonly confirming: DashboardSpot | null;
  readonly ask: (spot: DashboardSpot) => void;
  // Closes the question; the row's delete button then takes focus back.
  readonly cancel: () => void;
  readonly cancelledId: string | null;
  readonly deleting: boolean;
  readonly error: DisplayedErrorCode | null;
  readonly confirm: () => Promise<void>;
}

// A refused delete leaves the spot in the list and says why; the list shows only what the API answered.
export function useSpotDeletion(target: SpotDeletionTarget): SpotDeletion {
  const request = useGuardedRequest();
  const [confirming, setConfirming] = useState<DashboardSpot | null>(null);
  const [cancelledId, setCancelledId] = useState<string | null>(null);
  const { error, remove } = useSpotRemoval(target, () => setConfirming(null));
  const ask = (spot: DashboardSpot) => {
    setCancelledId(null);
    setConfirming(spot);
  };
  const cancel = () => {
    setCancelledId(confirming?.id ?? null);
    setConfirming(null);
  };
  const confirm = () => (confirming === null ? Promise.resolve() : request.run(() => remove(confirming)));
  return { confirming, ask, cancel, cancelledId, deleting: request.busy, error, confirm };
}

function useSpotRemoval({ lotId, onDeleted, onRefused }: SpotDeletionTarget, onSettled: () => void) {
  const refreshSession = useSessionRefresh();
  const [error, setError] = useState<DisplayedErrorCode | null>(null);
  const remove = async (spot: DashboardSpot) => {
    try {
      onDeleted(await dashboardClient.deleteSpot(lotId, spot.id), spot);
      setError(null);
    } catch (failure) {
      const refusal = asDashboardApiError(failure);
      if (endsSession(refusal)) {
        void refreshSession();
      }
      onRefused(refusal.code);
      setError(refusal.code);
    }
    onSettled();
  };
  return { error, remove };
}
