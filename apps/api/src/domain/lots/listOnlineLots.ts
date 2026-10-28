import type { LotSummary } from '@palier/shared-types';
import { freeSpotCount } from '../occupancy/freeSpotCount.ts';
import type { LotAvailabilityRepository } from './LotAvailabilityRepository.ts';

export async function listOnlineLots(repository: LotAvailabilityRepository): Promise<readonly LotSummary[]> {
  const availabilities = await repository.findOnlineLots();
  return availabilities.map((availability) => ({
    id: availability.id,
    name: availability.name,
    freeSpots: freeSpotCount(availability),
  }));
}
