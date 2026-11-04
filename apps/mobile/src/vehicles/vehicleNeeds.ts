import type { VehicleNeeds } from '@palier/shared-types';
import { i18n } from '../i18n/i18n';

export type VehicleNeed = keyof VehicleNeeds;

export const VEHICLE_NEEDS: readonly VehicleNeed[] = ['isElectric', 'hasAccessiblePermit', 'isOversize'];

export const NO_NEEDS: VehicleNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };

export function needLabel(need: VehicleNeed): string {
  return i18n.t(`vehicles.${need}`);
}

// The labels of the needs a vehicle has, in form order.
export function declaredNeeds(needs: VehicleNeeds): readonly string[] {
  return VEHICLE_NEEDS.filter((need) => needs[need]).map(needLabel);
}
