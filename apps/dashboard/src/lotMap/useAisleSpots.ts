import type { DashboardAisleSpots } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useSavedResource, type SavedResource } from '../api/useSavedResource.ts';

export function useAisleSpots(lotId: string, aisleId: string): SavedResource<DashboardAisleSpots> {
  return useSavedResource(useCallback(() => dashboardClient.aisleSpots(lotId, aisleId), [lotId, aisleId]));
}
