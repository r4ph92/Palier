import type { PlanAisle } from '@palier/shared-types';

// A minor that matches no aisle of the plan (the exit lane, another lot's beacon) is null.
export function aisleWithMinor(aisles: readonly PlanAisle[], minor: number): PlanAisle | null {
  return aisles.find((aisle) => aisle.beaconMinor === minor) ?? null;
}
