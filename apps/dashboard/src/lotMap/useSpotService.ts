import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { followUpRefusal, type Refusal, type StaleDataFollowUps } from '../api/followUpRefusal.ts';
import { useGuardedRequest } from '../forms/useGuardedRequest.ts';
import { useSessionRefresh } from '../session/SessionRefreshContext.tsx';

export type ServiceAction = 'takeOutOfService' | 'putBackInService';

export function serviceActionOf(spot: DashboardSpot): ServiceAction {
  return spot.state === 'OUT_OF_SERVICE' ? 'putBackInService' : 'takeOutOfService';
}

const SERVICE_CALLS = { takeOutOfService: 'takeSpotOutOfService', putBackInService: 'putSpotBackInService' } as const;

export interface SpotServiceTarget {
  readonly lotId: string;
  readonly onChanged: (spots: DashboardAisleSpots, spot: DashboardSpot, action: ServiceAction) => void;
  readonly onRefused: (refusal: Refusal, spotId: string) => void;
  readonly staleData: StaleDataFollowUps;
}

export interface SpotService {
  readonly busy: boolean;
  readonly busySpotId: string | null;
  readonly toggle: (spot: DashboardSpot) => Promise<void>;
}

// A refused change leaves the spot as it was and says why, naming the spot; the list shows only what the API answered.
export function useSpotService({ lotId, onChanged, onRefused, staleData }: SpotServiceTarget): SpotService {
  const request = useGuardedRequest();
  const refreshSession = useSessionRefresh();
  const { busySpotId, runFor } = useBusySpot();
  const change = async (spot: DashboardSpot) => {
    const action = serviceActionOf(spot);
    try {
      onChanged(await dashboardClient[SERVICE_CALLS[action]](lotId, spot.id), spot, action);
    } catch (failure) {
      const { code, values } = await followUpRefusal(failure, { refreshSession, ...staleData });
      onRefused({ code, values: { number: spot.number, ...values } }, spot.id);
    }
  };
  return { busy: request.busy, busySpotId, toggle: (spot) => request.run(() => runFor(spot.id, () => change(spot))) };
}

function useBusySpot() {
  const [busySpotId, setBusySpotId] = useState<string | null>(null);
  const runFor = async (spotId: string, work: () => Promise<void>) => {
    setBusySpotId(spotId);
    try {
      await work();
    } finally {
      setBusySpotId(null);
    }
  };
  return { busySpotId, runFor };
}
