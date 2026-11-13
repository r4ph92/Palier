import type { DashboardLotMap } from '@palier/shared-types';
import { useCallback, useState } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useResource, type LoadedResource } from '../api/useResource.ts';

export interface LotMapState extends LoadedResource<DashboardLotMap> {
  // The map a write answered, shown in place of the first load: the page always shows what the API saved.
  readonly latest: DashboardLotMap | null;
  readonly show: (map: DashboardLotMap) => void;
  // Reads the map again after a write refused because the page was out of date; a failed read keeps the map shown.
  readonly refresh: () => Promise<void>;
}

export function useLotMap(lotId: string): LotMapState {
  const loaded = useResource(useCallback(() => dashboardClient.lotMap(lotId), [lotId]));
  const [latest, setLatest] = useState<DashboardLotMap | null>(null);
  const refresh = useCallback(async () => {
    try {
      setLatest(await dashboardClient.lotMap(lotId));
    } catch {
      // The refusal already shown tells the operator to reload.
    }
  }, [lotId]);
  return { ...loaded, latest, show: setLatest, refresh };
}
