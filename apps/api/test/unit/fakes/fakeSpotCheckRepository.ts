import type { DashboardSpotsToCheck, DashboardSpotToCheck } from '@palier/shared-types';
import { clearDecisionOf } from '../../../src/domain/dashboard/clearDecisionOf.ts';
import type { SpotPlace } from '../../../src/domain/dashboard/LotSpotRepository.ts';
import type { SpotCheckRefusal, SpotCheckRepository } from '../../../src/domain/dashboard/SpotCheckRepository.ts';
import type { FakeLotMapRepository } from './fakeLotMapRepository.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';
import type { FakeLotSpotRepository, FakeSpot } from './fakeLotSpotRepository.ts';

// Keeps the rules the SQL keeps: the operator's lot and live flagged spots oldest first; clearDecisionOf decides a clear, as in Postgres.
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

  listSpotsToCheck(operatorId: string, lotId: string): Promise<DashboardSpotsToCheck | null> {
    const lot = this.#lots.owned[this.#lots.indexOf(operatorId, lotId)];
    if (lot === undefined) {
      return Promise.resolve(null);
    }
    const flagged = this.#spots.spots.filter((spot) => spot.lotId === lotId && !spot.retired && spot.check !== null && spot.state !== 'OUT_OF_SERVICE');
    const spots = flagged.map((spot) => this.#toCheckOf(spot)).sort((left, right) => left.since.localeCompare(right.since));
    return Promise.resolve({ lotName: lot.name, spots });
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
    const decision = clearDecisionOf({ state: spot.state, needsCheck: spot.check !== null, heldBySession: spot.isHeldBySession });
    if (decision !== 'CLEAR' && decision !== 'ALREADY_CLEAR') {
      return Promise.resolve(decision);
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
      clearable: clearDecisionOf({ state: spot.state, needsCheck: true, heldBySession: spot.isHeldBySession }) === 'CLEAR',
      heldBySession: spot.isHeldBySession,
    };
  }
}
