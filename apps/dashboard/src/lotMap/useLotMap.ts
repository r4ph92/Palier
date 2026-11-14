import type { DashboardLotMap } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useSavedResource, type SavedResource } from '../api/useSavedResource.ts';

export function useLotMap(lotId: string): SavedResource<DashboardLotMap> {
  return useSavedResource(useCallback(() => dashboardClient.lotMap(lotId), [lotId]));
}
