import type { LotAvailability } from './LotAvailability.ts';

export type LotOccupancy = Pick<LotAvailability, 'capacity' | 'vehicleCount' | 'heldSpotCount' | 'assignedSpotCount'>;

// A held spot is promised to a driver on the way, and an assigned spot to an entry admitted but not yet through the loop:
// both take room like a vehicle already inside. Can be negative; freeSpotCount floors the displayed count at 0.
export function vehicleRoomLeft({ capacity, vehicleCount, heldSpotCount, assignedSpotCount }: LotOccupancy): number {
  return capacity - vehicleCount - heldSpotCount - assignedSpotCount;
}

// Same count as freeSpotCount: a lot can be full by vehicles inside, holds and admitted entries even while spots look free.
export function hasRoomForAnotherVehicle(lot: LotOccupancy): boolean {
  return vehicleRoomLeft(lot) > 0;
}
