import type { DashboardSpotsToCheck, DashboardSpotToCheck } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { type DisplayedErrorCode } from '../api/DashboardApiError.ts';
import { followUpRefusal, type Refusal, type RefusalFollowUps } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useFocusAfterRender } from '../lotMap/useFocusAfterRender.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';
import { checkButtonId, SPOT_CHECK_STATUS_ID } from './spotCheckIds.ts';

// After these refusals the flagged list on the page is out of date: it is read again before the operator retries.
const LIST_OUT_OF_DATE: readonly DisplayedErrorCode[] = ['LOT_BUSY', 'SPOT_NOT_FOUND'];

export interface RowRefusal extends Refusal {
  readonly spotId: string;
}

interface ClearStatus {
  // The spot being cleared; its row shows the busy state and no other row accepts a click meanwhile.
  readonly clearingId: string | null;
  readonly refusal: RowRefusal | null;
  // The spot cleared last, for the status line; any later click forgets it.
  readonly clearedNumber: string | null;
}

export interface SpotCheckClearing extends ClearStatus {
  readonly spots: readonly DashboardSpotToCheck[];
  readonly clear: (spot: DashboardSpotToCheck) => Promise<void>;
}

type ClearOutcome = { readonly answer: DashboardSpotsToCheck } | { readonly refusal: Refusal };

const IDLE: ClearStatus = { clearingId: null, refusal: null, clearedNumber: null };

async function attemptClear(lotId: string, spot: DashboardSpotToCheck, followUps: RefusalFollowUps): Promise<ClearOutcome> {
  try {
    return { answer: await dashboardClient.clearSpotCheck(lotId, spot.spotId) };
  } catch (failure) {
    return { refusal: await followUpRefusal(failure, followUps) };
  }
}

// Focus stays in the list: on the row that takes the cleared one's place, or the one before it, or the status line once the list is empty.
function focusIdAfterClearing(spots: readonly DashboardSpotToCheck[], cleared: DashboardSpotToCheck): string {
  const index = spots.findIndex(({ spotId }) => spotId === cleared.spotId);
  const neighbour = spots[index + 1] ?? spots[index - 1];
  return neighbour === undefined ? SPOT_CHECK_STATUS_ID : checkButtonId(neighbour.spotId);
}

// The list shows only what the API answered: a cleared spot leaves it, a refused one stays with the reason beside its row.
export function useSpotCheckClearing(lotId: string, initial: DashboardSpotsToCheck): SpotCheckClearing {
  const request = useGuardedRequest();
  const focusAfterRender = useFocusAfterRender();
  const [spots, setSpots] = useState(initial.spots);
  const [status, setStatus] = useState<ClearStatus>(IDLE);
  const followUps = useRefusalFollowUps(lotId, setSpots);
  const clear = (spot: DashboardSpotToCheck) =>
    request.run(async () => {
      setStatus({ ...IDLE, clearingId: spot.spotId });
      const outcome = await attemptClear(lotId, spot, followUps);
      if ('refusal' in outcome) {
        setStatus({ ...IDLE, refusal: { ...outcome.refusal, spotId: spot.spotId } });
        return;
      }
      focusAfterRender(focusIdAfterClearing(spots, spot));
      setSpots(outcome.answer.spots);
      setStatus({ ...IDLE, clearedNumber: spot.number });
    });
  return { ...status, spots, clear };
}

function useRefusalFollowUps(lotId: string, show: (spots: readonly DashboardSpotToCheck[]) => void): RefusalFollowUps {
  const refreshSession = useSessionRefresh();
  const reloadList = async (): Promise<boolean> => {
    try {
      show((await dashboardClient.spotsToCheck(lotId)).spots);
      return true;
    } catch {
      return false;
    }
  };
  const refreshOn = (code: DisplayedErrorCode) => (LIST_OUT_OF_DATE.includes(code) ? reloadList() : null);
  return { refreshSession, refreshOn, reloadFailedCode: 'SPOT_RELOAD_FAILED' };
}
