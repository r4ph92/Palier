import type { CounterGap } from '@palier/shared-types';

export function computeCounterGap(vehicleCount: number, occupiedOrAssignedCount: number): CounterGap {
  if (vehicleCount < occupiedOrAssignedCount) {
    return { kind: 'COUNTER_BELOW', spots: occupiedOrAssignedCount - vehicleCount };
  }
  return { kind: 'SPOTS_TO_CHECK', spots: vehicleCount - occupiedOrAssignedCount };
}
