import type { LotSummary } from '@palier/shared-types';
import { freeSpotCount } from '../occupancy/freeSpotCount.ts';
import { freeSpotsByCategory } from '../occupancy/freeSpotsByCategory.ts';
import type { LotAvailabilityRepository } from './LotAvailabilityRepository.ts';
import type { OnlineLot } from './OnlineLot.ts';

// Lots are read by name before the app measures distances: past this many, a nearby lot can be left out.
export const ONLINE_LOTS_LIMIT = 50;

export interface LotListLog {
  warn(details: object, message: string): void;
}

let limitWarned = false;

// Asks for one lot more than the limit to tell a full list from a truncated one; warns once, not on every request.
export async function listOnlineLots(repository: LotAvailabilityRepository, log: LotListLog): Promise<readonly LotSummary[]> {
  const lots = await repository.findOnlineLots(ONLINE_LOTS_LIMIT + 1);
  if (lots.length > ONLINE_LOTS_LIMIT && !limitWarned) {
    limitWarned = true;
    log.warn({ limit: ONLINE_LOTS_LIMIT }, 'the online lot list reached its limit: lots past it by name are not listed');
  }
  return lots.slice(0, ONLINE_LOTS_LIMIT).map(lotSummary);
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
