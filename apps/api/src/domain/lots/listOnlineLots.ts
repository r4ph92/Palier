import type { LotSummary } from '@palier/shared-types';
import { freeSpotCount } from '../occupancy/freeSpotCount.ts';
import { freeSpotsByCategory } from '../occupancy/freeSpotsByCategory.ts';
import type { LotAvailabilityRepository } from './LotAvailabilityRepository.ts';
import type { OnlineLot } from './OnlineLot.ts';

// Every online lot, by name: the app keeps those within 10 km itself, so a nearby lot is never left out (decision 015).
export async function listOnlineLots(repository: LotAvailabilityRepository): Promise<readonly LotSummary[]> {
  const lots = await repository.findOnlineLots();
  return lots.map(lotSummary);
}

function lotSummary({ id, name, location, availability, tariff }: OnlineLot): LotSummary {
  return {
    id,
    name,
    freeSpots: freeSpotCount(availability),
    capacity: availability.capacity,
    freeSpotsByCategory: freeSpotsByCategory(availability),
    location,
    tariff,
  };
}
