import { freeSpotCount } from '../occupancy/freeSpotCount.ts';
import type { LotAvailabilityRepository } from './LotAvailabilityRepository.ts';

export interface OnlineLot {
  readonly id: string;
  readonly name: string;
  readonly freeSpots: number;
}

export async function listOnlineLots(repository: LotAvailabilityRepository): Promise<readonly OnlineLot[]> {
  const availabilities = await repository.findOnlineLots();
  return availabilities.map((availability) => ({
    id: availability.id,
    name: availability.name,
    freeSpots: freeSpotCount(availability),
  }));
}
