import type { LotAvailability } from './LotAvailability.ts';

export type LotOccupancy = Pick<LotAvailability, 'capacity' | 'vehicleCount' | 'heldSpotCount'>;

// A held spot is promised to a driver on the way, so it takes room like a vehicle already inside.
export function vehicleRoomLeft({ capacity, vehicleCount, heldSpotCount }: LotOccupancy): number {
  return capacity - vehicleCount - heldSpotCount;
}

// Same count as freeSpotCount: a lot can be full by vehicles inside and holds even while spots look free.
export function hasRoomForAnotherVehicle(lot: LotOccupancy): boolean {
  return vehicleRoomLeft(lot) > 0;
}
