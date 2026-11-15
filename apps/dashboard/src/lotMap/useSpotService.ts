import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { dashboardClient } from '../api/dashboardClient.ts';
import { followUpRefusal, type Refusal, type StaleDataFollowUps } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';

export interface SpotServiceTarget {
  readonly lotId: string;
  readonly onChanged: (spots: DashboardAisleSpots, spot: DashboardSpot, outOfService: boolean) => void;
  readonly onRefused: (refusal: Refusal) => void;
  readonly staleData: StaleDataFollowUps;
}

export interface SpotService {
  readonly busy: boolean;
  // Takes a spot out of service, or brings an out-of-service spot back.
  readonly toggle: (spot: DashboardSpot) => Promise<void>;
}

// A refused change leaves the spot as it was and says why, naming the spot; the list shows only what the API answered.
export function useSpotService({ lotId, onChanged, onRefused, staleData }: SpotServiceTarget): SpotService {
  const request = useGuardedRequest();
  const refreshSession = useSessionRefresh();
  const change = async (spot: DashboardSpot) => {
    const outOfService = spot.state !== 'OUT_OF_SERVICE';
    try {
      onChanged(await dashboardClient.setSpotService(lotId, spot.id, outOfService), spot, outOfService);
    } catch (failure) {
      const { code, values } = await followUpRefusal(failure, { refreshSession, ...staleData });
      onRefused({ code, values: { number: spot.number, ...values } });
    }
  };
  return { busy: request.busy, toggle: (spot) => request.run(() => change(spot)) };
}
