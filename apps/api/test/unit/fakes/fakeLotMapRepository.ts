import { randomUUID } from 'node:crypto';
import type { LevelOrderRequest } from '@palier/shared-types';
import type { AisleDraft } from '@palier/shared-types/aisleDraft';
import { EXIT_LANE_CODE, EXIT_LANE_MINOR, PLATFORM_BEACON_UUID } from '@palier/shared-types/beacons';
import { MAX_LEVELS_PER_LOT } from '@palier/shared-types/levelDraft';
import { isMoveOfCurrentOrder } from '../../../src/domain/dashboard/levelOrder.ts';
import {
  LOT_MAP_WRITTEN,
  type AislePlacement,
  type LevelPlacement,
  type LotMapRepository,
  type LotMapWrite,
  type StoredLotMap,
  type StoredMapAisle,
  type StoredMapLevel,
} from '../../../src/domain/dashboard/LotMapRepository.ts';
import type { RecordedBatteryReading } from '../../../src/domain/equipment/batteryReadings.ts';
import { aisleRectangleOf } from '../../../src/domain/lots/AisleRectangle.ts';
import { parkingDemoAisles, parkingDemoLevels } from '../../../src/seed/fixtures/parkingDemo.ts';
import type { FakeLotStore } from './fakeLotSetupRepository.ts';

export interface FakeLevel extends StoredMapLevel {
  readonly lotId: string;
  displayOrder: number;
  readonly aisles: StoredMapAisle[];
}

const NO_BATTERY_READING = { batteryPercent: null, batteryReportedAt: null };

// Parking Démo as seeded: level P1 with aisles A and B and the exit lane; Garage Roy has no level yet.
function seededLevels(): FakeLevel[] {
  return parkingDemoLevels.map(({ id = '', lotId, code, displayOrder }) => ({
    id,
    lotId,
    code,
    displayOrder,
    aisles: parkingDemoAisles
      .filter((aisle) => aisle.levelId === id)
      .map((aisle) => {
        const reading = aisleRectangleOf(aisle.mapPolygon);
        const rectangle = reading.kind === 'drawn' ? reading.rectangle : null;
        return { id: aisle.id ?? '', code: aisle.code, beaconMinor: aisle.beaconMinor, isExitLane: aisle.isExitLane ?? false, rectangle, ...NO_BATTERY_READING };
      }),
  }));
}

// Keeps the constraints the SQL keeps: codes and minors taken, the level limit, one exit lane per lot, only the operator's lots.
export class FakeLotMapRepository implements LotMapRepository {
  readonly levels: FakeLevel[] = seededLevels();
  readonly busyLots = new Set<string>();
  readonly #lots: FakeLotStore;

  constructor(lots: FakeLotStore) {
    this.#lots = lots;
  }

  readLotMap(operatorId: string, lotId: string): Promise<StoredLotMap | null> {
    const lot = this.#lots.owned[this.#lots.indexOf(operatorId, lotId)];
    if (lot === undefined) {
      return Promise.resolve(null);
    }
    const levels = this.#levelsOf(lotId).map(({ id, code, displayOrder, aisles }) => ({ id, code, displayOrder, aisles: [...aisles].sort(byCodeExitLaneLast) }));
    return Promise.resolve({ lotId, lotName: lot.name, platformUuid: PLATFORM_BEACON_UUID, beaconMajor: lot.beaconMajor, levels });
  }

  addLevel(operatorId: string, lotId: string, code: string): Promise<LotMapWrite> {
    return this.#write(operatorId, lotId, () => {
      const levels = this.#levelsOf(lotId);
      if (levels.length >= MAX_LEVELS_PER_LOT) {
        return 'LEVEL_LIMIT_REACHED';
      }
      if (levels.some((level) => level.code === code)) {
        return 'LEVEL_CODE_TAKEN';
      }
      const hasExitLane = levels.some(({ aisles }) => aisles.some(({ isExitLane }) => isExitLane));
      const exitLane: StoredMapAisle = { id: randomUUID(), code: EXIT_LANE_CODE, beaconMinor: EXIT_LANE_MINOR, isExitLane: true, rectangle: null, ...NO_BATTERY_READING };
      this.levels.push({ id: randomUUID(), lotId, code, displayOrder: levels.length + 1, aisles: hasExitLane ? [] : [exitLane] });
      return LOT_MAP_WRITTEN;
    });
  }

  reorderLevels(operatorId: string, lotId: string, order: LevelOrderRequest): Promise<LotMapWrite> {
    return this.#write(operatorId, lotId, () => {
      const levels = this.#levelsOf(lotId);
      if (!isMoveOfCurrentOrder(order, levels.map(({ id }) => id))) {
        return 'LEVEL_ORDER_INVALID';
      }
      levels.forEach((level) => (level.displayOrder = order.levelIds.indexOf(level.id) + 1));
      return LOT_MAP_WRITTEN;
    });
  }

  addAisle(operatorId: string, { lotId, levelId }: LevelPlacement, aisle: AisleDraft): Promise<LotMapWrite> {
    return this.#write(operatorId, lotId, () => {
      const levels = this.#levelsOf(lotId);
      const level = levels.find(({ id }) => id === levelId);
      if (level === undefined) {
        return 'LEVEL_NOT_FOUND';
      }
      if (level.aisles.some(({ code }) => code === aisle.code)) {
        return 'AISLE_CODE_TAKEN';
      }
      if (levels.some(({ aisles }) => aisles.some(({ beaconMinor }) => beaconMinor === aisle.beaconMinor))) {
        return 'AISLE_MINOR_TAKEN';
      }
      level.aisles.push({ id: randomUUID(), ...aisle, isExitLane: false, ...NO_BATTERY_READING });
      return LOT_MAP_WRITTEN;
    });
  }

  // No lot lock in the SQL, so a busy lot does not refuse a reading.
  recordBeaconBattery(operatorId: string, { lotId, aisleId }: AislePlacement, { percent, reportedAt }: RecordedBatteryReading): Promise<LotMapWrite> {
    if (this.#lots.indexOf(operatorId, lotId) < 0) {
      return Promise.resolve('LOT_NOT_FOUND');
    }
    const level = this.#levelsOf(lotId).find(({ aisles }) => aisles.some(({ id }) => id === aisleId));
    if (level === undefined) {
      return Promise.resolve('AISLE_NOT_FOUND');
    }
    const index = level.aisles.findIndex(({ id }) => id === aisleId);
    level.aisles.splice(index, 1, { ...(level.aisles[index] as StoredMapAisle), batteryPercent: percent, batteryReportedAt: reportedAt });
    return Promise.resolve(LOT_MAP_WRITTEN);
  }

  #write(operatorId: string, lotId: string, change: () => LotMapWrite): Promise<LotMapWrite> {
    if (this.#lots.indexOf(operatorId, lotId) < 0) {
      return Promise.resolve('LOT_NOT_FOUND');
    }
    return Promise.resolve(this.busyLots.has(lotId) ? 'LOT_BUSY' : change());
  }

  #levelsOf(lotId: string): FakeLevel[] {
    return this.levels.filter((level) => level.lotId === lotId).sort((left, right) => left.displayOrder - right.displayOrder);
  }
}

function byCodeExitLaneLast(left: StoredMapAisle, right: StoredMapAisle): number {
  return Number(left.isExitLane) - Number(right.isExitLane) || left.code.localeCompare(right.code);
}
