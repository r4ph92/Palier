import type { VehicleNeeds } from '@palier/shared-types';
import { useCallback, useState } from 'react';
import type { VehicleNeed } from './vehicleNeeds';

export function useVehicleNeeds(initial: VehicleNeeds): { readonly needs: VehicleNeeds; toggleNeed(need: VehicleNeed): void } {
  const [needs, setNeeds] = useState<VehicleNeeds>(initial);
  const toggleNeed = useCallback((need: VehicleNeed) => setNeeds((previous) => ({ ...previous, [need]: !previous[need] })), []);
  return { needs, toggleNeed };
}
