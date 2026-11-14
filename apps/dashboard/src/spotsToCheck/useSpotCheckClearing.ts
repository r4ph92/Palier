import type { DashboardSpotToCheck } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { asDashboardApiError, endsSession, type DashboardApiError, type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';

export interface RowRefusal {
  readonly spotId: string;
  readonly code: DisplayedErrorCode;
}

interface ClearStatus {
  // The spot being cleared; its row shows the busy state and no other row accepts a click meanwhile.
  readonly clearingId: string | null;
  readonly refusal: RowRefusal | null;
  // The spot cleared last, for the status line.
  readonly clearedNumber: string | null;
}

export interface SpotCheckClearing extends ClearStatus {
  readonly spots: readonly DashboardSpotToCheck[];
  readonly clear: (spot: DashboardSpotToCheck) => Promise<void>;
}

type ClearOutcome = { readonly spots: readonly DashboardSpotToCheck[] } | { readonly error: DashboardApiError };

async function attemptClear(lotId: string, spot: DashboardSpotToCheck): Promise<ClearOutcome> {
  try {
    return { spots: await dashboardClient.clearSpotCheck(lotId, spot.spotId) };
  } catch (failure) {
    return { error: asDashboardApiError(failure) };
  }
}

function refreshWhenSessionEnded(error: DashboardApiError, refreshSession: () => Promise<void>): void {
  if (endsSession(error)) {
    void refreshSession();
  }
}

// The list shows only what the API answered: a cleared spot leaves it, a refused one stays with the reason beside its row.
export function useSpotCheckClearing(lotId: string, initial: readonly DashboardSpotToCheck[]): SpotCheckClearing {
  const request = useGuardedRequest();
  const refreshSession = useSessionRefresh();
  const [spots, setSpots] = useState(initial);
  const [status, setStatus] = useState<ClearStatus>({ clearingId: null, refusal: null, clearedNumber: null });
  const clear = (spot: DashboardSpotToCheck) =>
    request.run(async () => {
      setStatus({ ...status, clearingId: spot.spotId, refusal: null });
      const outcome = await attemptClear(lotId, spot);
      if ('error' in outcome) {
        setStatus({ ...status, clearingId: null, refusal: { spotId: spot.spotId, code: outcome.error.code } });
        refreshWhenSessionEnded(outcome.error, refreshSession);
        return;
      }
      setSpots(outcome.spots);
      setStatus({ clearingId: null, refusal: null, clearedNumber: spot.number });
    });
  return { ...status, spots, clear };
}
