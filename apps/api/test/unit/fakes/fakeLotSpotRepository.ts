import { randomUUID } from 'node:crypto';
import type { DashboardAisleSpots, DashboardSpot } from '@palier/shared-types';
import { MAX_SPOTS_PER_LOT, type SpotAttributes } from '@palier/shared-types/spotDraft';
import { canonicalSpotNumber } from '@palier/shared-types/spotNumber';
import type { AislePlace, LotSpotRepository, LotSpotWrite, SpotBatch, SpotPlace } from '../../../src/domain/dashboard/LotSpotRepository.ts';
import type { SpotState } from '../../../src/domain/spots/spotStates.ts';
import { parkingDemoSpots } from '../../../src/seed/fixtures/parkingDemo.ts';
import type { FakeLotMapRepository } from './fakeLotMapRepository.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';

export interface FakeSpot extends DashboardSpot {
  readonly lotId: string;
  readonly aisleId: string;
  state: SpotState;
  retired: boolean;
  // A session, hold or report pointed at it once: deleting it retires it instead.
  hasHistory: boolean;
  // An active session or hold points at it, whatever its state says.
  isHeldBySession: boolean;
}

const FREE_STATES: readonly SpotState[] = ['AVAILABLE', 'OUT_OF_SERVICE'];
const TRAILING_DIGITS = /\d+$/;

function seededSpots(): FakeSpot[] {
  return parkingDemoSpots.map(({ aisleId, lotId, number, distanceToExit, isEv = false, isAccessible = false, isOversize = false }) => ({
    ...{ id: randomUUID(), aisleId, lotId, number, distanceToExit, isEv, isAccessible, isOversize },
    ...{ state: 'AVAILABLE', retired: false, hasHistory: false, isHeldBySession: false },
  }));
}

// Keeps the rules the SQL keeps: the operator's lot, a parking aisle, the lot's limit, numbers read the same taken, spots in use kept.
export class FakeLotSpotRepository implements LotSpotRepository {
  readonly spots: FakeSpot[] = seededSpots();
  readonly busyLots = new Set<string>();
  readonly #lots: FakeLotStore;
  readonly #maps: FakeLotMapRepository;

  constructor(lots: FakeLotStore, maps: FakeLotMapRepository) {
    this.#lots = lots;
    this.#maps = maps;
  }

  readAisleSpots(operatorId: string, { lotId, aisleId }: AislePlace): Promise<DashboardAisleSpots | null> {
    if (this.#lots.indexOf(operatorId, lotId) < 0 || !this.#isParkingAisle(lotId, aisleId)) {
      return Promise.resolve(null);
    }
    const spots = this.#liveSpots(lotId).filter((spot) => spot.aisleId === aisleId).sort(inNaturalOrder).map(dashboardSpotOf);
    return Promise.resolve({ aisleId, spots, spotCount: this.#liveSpots(lotId).length, capacity: this.#lots.byId(lotId)?.capacity ?? 0 });
  }

  addSpots(operatorId: string, { lotId, aisleId }: AislePlace, { numbers, attributes }: SpotBatch): Promise<LotSpotWrite> {
    return this.#write(operatorId, lotId, () => {
      if (!this.#isParkingAisle(lotId, aisleId)) {
        return 'AISLE_NOT_FOUND';
      }
      if (this.#liveSpots(lotId).length + numbers.length > MAX_SPOTS_PER_LOT) {
        return 'SPOT_LIMIT_REACHED';
      }
      const taken = this.#firstTaken(lotId, numbers);
      if (taken !== undefined) {
        return { takenNumber: taken };
      }
      this.spots.push(...numbers.map((number) => newSpot({ lotId, aisleId }, number, attributes)));
      return { aisleId };
    });
  }

  changeSpot(operatorId: string, place: SpotPlace, attributes: SpotAttributes): Promise<LotSpotWrite> {
    return this.#write(operatorId, place.lotId, () => {
      const spot = this.#liveSpot(place);
      if (spot === undefined) {
        return 'SPOT_NOT_FOUND';
      }
      Object.assign(spot, attributes);
      return { aisleId: spot.aisleId };
    });
  }

  retireSpot(operatorId: string, place: SpotPlace): Promise<LotSpotWrite> {
    return this.#write(operatorId, place.lotId, () => {
      const spot = this.#liveSpot(place);
      if (spot === undefined) {
        return 'SPOT_NOT_FOUND';
      }
      if (!FREE_STATES.includes(spot.state) || spot.isHeldBySession) {
        return 'SPOT_IN_USE';
      }
      this.#retire(spot);
      return { aisleId: spot.aisleId };
    });
  }

  #retire(spot: FakeSpot): void {
    if (!spot.hasHistory) {
      this.spots.splice(this.spots.indexOf(spot), 1);
      return;
    }
    spot.retired = true;
    spot.state = 'OUT_OF_SERVICE';
  }

  #write(operatorId: string, lotId: string, change: () => LotSpotWrite): Promise<LotSpotWrite> {
    if (this.#lots.indexOf(operatorId, lotId) < 0) {
      return Promise.resolve('LOT_NOT_FOUND');
    }
    return Promise.resolve(this.busyLots.has(lotId) ? 'LOT_BUSY' : change());
  }

  #isParkingAisle(lotId: string, aisleId: string): boolean {
    return this.#maps.levels.some((level) => level.lotId === lotId && level.aisles.some(({ id, isExitLane }) => id === aisleId && !isExitLane));
  }

  #liveSpots(lotId: string): FakeSpot[] {
    return this.spots.filter((spot) => spot.lotId === lotId && !spot.retired);
  }

  #liveSpot({ lotId, spotId }: SpotPlace): FakeSpot | undefined {
    return this.#liveSpots(lotId).find(({ id }) => id === spotId);
  }

  #firstTaken(lotId: string, numbers: readonly string[]): string | undefined {
    const live = this.#liveSpots(lotId);
    const takenOf = (number: string) => live.find((spot) => canonicalSpotNumber(spot.number) === canonicalSpotNumber(number))?.number;
    return numbers.map(takenOf).find((taken) => taken !== undefined);
  }
}

function newSpot({ lotId, aisleId }: AislePlace, number: string, attributes: SpotAttributes): FakeSpot {
  return { id: randomUUID(), lotId, aisleId, number, ...attributes, state: 'AVAILABLE', retired: false, hasHistory: false, isHeldBySession: false };
}

function dashboardSpotOf({ id, number, state, isEv, isAccessible, isOversize, distanceToExit }: FakeSpot): DashboardSpot {
  return { id, number, state, isEv, isAccessible, isOversize, distanceToExit };
}

function inNaturalOrder(left: FakeSpot, right: FakeSpot): number {
  const prefixOrder = left.number.replace(TRAILING_DIGITS, '').localeCompare(right.number.replace(TRAILING_DIGITS, ''));
  return prefixOrder || trailingNumberOf(left.number) - trailingNumberOf(right.number);
}

function trailingNumberOf(number: string): number {
  return Number(TRAILING_DIGITS.exec(number)?.[0] ?? -1);
}
