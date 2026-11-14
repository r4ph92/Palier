import type { DashboardSpotToCheck } from '@palier/shared-types';
import type { SpotPlace } from '../../../src/domain/dashboard/LotSpotRepository.ts';
import type { SpotCheckRefusal, SpotCheckRepository } from '../../../src/domain/dashboard/SpotCheckRepository.ts';
import type { FakeLotMapRepository } from './fakeLotMapRepository.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';
import type { FakeLotSpotRepository, FakeSpot } from './fakeLotSpotRepository.ts';

// Keeps the rules the SQL keeps: the operator's lot, live flagged spots oldest first, and a clear only on a free spot nothing holds.
export class FakeSpotCheckRepository implements SpotCheckRepository {
  readonly busyLots = new Set<string>();
  readonly #lots: FakeLotStore;
  readonly #maps: FakeLotMapRepository;
  readonly #spots: FakeLotSpotRepository;

  constructor(lots: FakeLotStore, maps: FakeLotMapRepository, spots: FakeLotSpotRepository) {
    this.#lots = lots;
    this.#maps = maps;
    this.#spots = spots;
  }

  listSpotsToCheck(operatorId: string, lotId: string): Promise<readonly DashboardSpotToCheck[] | null> {
    if (this.#lots.indexOf(operatorId, lotId) < 0) {
      return Promise.resolve(null);
    }
    const flagged = this.#spots.spots.filter((spot) => spot.lotId === lotId && !spot.retired && spot.check !== null);
    return Promise.resolve(flagged.map((spot) => this.#toCheckOf(spot)).sort((left, right) => left.since.localeCompare(right.since)));
  }

  clearSpotCheck(operatorId: string, { lotId, spotId }: SpotPlace): Promise<'CLEARED' | SpotCheckRefusal> {
    if (this.#lots.indexOf(operatorId, lotId) < 0) {
      return Promise.resolve('LOT_NOT_FOUND');
    }
    if (this.busyLots.has(lotId)) {
      return Promise.resolve('LOT_BUSY');
    }
    const spot = this.#spots.spots.find((candidate) => candidate.id === spotId && candidate.lotId === lotId && !candidate.retired);
    if (spot === undefined) {
      return Promise.resolve('SPOT_NOT_FOUND');
    }
    if (spot.check !== null && (spot.state !== 'AVAILABLE' || spot.isHeldBySession)) {
      return Promise.resolve('SPOT_STILL_ASSIGNED');
    }
    spot.check = null;
    return Promise.resolve('CLEARED');
  }

  #toCheckOf(spot: FakeSpot): DashboardSpotToCheck {
    const level = this.#maps.levels.find(({ aisles }) => aisles.some(({ id }) => id === spot.aisleId));
    const aisle = level?.aisles.find(({ id }) => id === spot.aisleId);
    return {
      spotId: spot.id,
      number: spot.number,
      levelCode: level?.code ?? '',
      aisleCode: aisle?.code ?? '',
      since: spot.check?.since ?? '',
      reason: spot.check?.reason ?? null,
      state: spot.state,
    };
  }
}
