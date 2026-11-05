import type { LotAvailability } from './LotAvailability.ts';

export type LotOccupancy = Pick<LotAvailability, 'capacity' | 'vehicleCount'>;

// Same count as freeSpotCount: a lot can be full by vehicles inside even while spots look free.
export function hasRoomForAnotherVehicle(lot: LotOccupancy): boolean {
  return lot.capacity - lot.vehicleCount > 0;
}
