import type { DashboardLotGates } from '@palier/shared-types';
import { useCallback } from 'react';
import { dashboardClient } from '../api/dashboardClient.ts';
import { useSavedResource, type SavedResource } from '../api/useSavedResource.ts';

// Not polled: a poll would reset an edit form the operator is filling in.
export function useLotGates(lotId: string): SavedResource<DashboardLotGates> {
  return useSavedResource(useCallback(() => dashboardClient.lotGates(lotId), [lotId]));
}
