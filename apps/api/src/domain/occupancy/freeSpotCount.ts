import { vehicleRoomLeft } from './hasRoomForAnotherVehicle.ts';
import type { LotAvailability } from './LotAvailability.ts';

export function freeSpotCount(availability: LotAvailability): number {
  return Math.max(0, Math.min(vehicleRoomLeft(availability), availability.availableSpotCount));
}
