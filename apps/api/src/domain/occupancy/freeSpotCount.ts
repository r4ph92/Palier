import type { LotAvailability } from './LotAvailability.ts';

export function freeSpotCount(availability: LotAvailability): number {
  const spotsLeftByVehicleCount = availability.capacity - availability.vehicleCount;
  return Math.max(0, Math.min(spotsLeftByVehicleCount, availability.availableSpotCount));
}
