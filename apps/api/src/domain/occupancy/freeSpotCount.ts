import type { LotAvailability } from './LotAvailability.ts';

export function freeSpotCount(availability: LotAvailability): number {
  return availability.availableSpotCount;
}
