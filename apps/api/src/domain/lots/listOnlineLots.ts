import type { LotSummary } from '@palier/shared-types';
import { freeSpotCount } from '../occupancy/freeSpotCount.ts';
import { freeSpotsByCategory } from '../occupancy/freeSpotsByCategory.ts';
import type { LotAvailabilityRepository } from './LotAvailabilityRepository.ts';
import type { OnlineLot } from './OnlineLot.ts';

export async function listOnlineLots(repository: LotAvailabilityRepository): Promise<readonly LotSummary[]> {
  const lots = await repository.findOnlineLots();
  return lots.map(lotSummary);
}

function lotSummary({ id, name, location, availability }: OnlineLot): LotSummary {
  return {
    id,
    name,
    freeSpots: freeSpotCount(availability),
    freeSpotsByCategory: freeSpotsByCategory(availability),
    location,
  };
}
