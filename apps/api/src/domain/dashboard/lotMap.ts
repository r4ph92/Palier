import type { DashboardLotMap, LevelOrderRequest } from '@palier/shared-types';
import { aisleDraftErrors, type AisleDraft, type AisleRequest } from '@palier/shared-types/aisleDraft';
import { beaconBatteryErrors, type BeaconBatteryReading } from '@palier/shared-types/beaconBattery';
import { canonicalCodeOf } from '@palier/shared-types/displayText';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { levelDraftErrors, type LevelDraft } from '@palier/shared-types/levelDraft';
import type { Clock } from '../time/Clock.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import { LOT_MAP_WRITTEN, type LotMapRepository, type LotMapWrite } from './LotMapRepository.ts';
import { lotMapViewOf } from './lotMapView.ts';
import type { MemberAisle } from './lotSpots.ts';
import { operatorIdOfMember, ownedLotOrNotFound, type MemberLot, type MemberOperators } from './memberOperator.ts';

export interface LotMapSources {
  readonly operators: MemberOperators;
  readonly maps: LotMapRepository;
  // Judges each battery reading's age at the moment of the read.
  readonly clock: Clock;
}

export interface MemberLevel extends MemberLot {
  readonly levelId: string;
}

type OperatorWrite = (operatorId: string) => Promise<LotMapWrite>;

export async function readLotMapOfMember(sources: LotMapSources, lot: MemberLot): Promise<DashboardLotMap> {
  return readOwnedLotMap(sources, await operatorIdOfMember(sources.operators, lot), lot.lotId);
}

// Each rule runs before any read, so a refused body says nothing about whether the lot exists.
export function addLevelOfMember(sources: LotMapSources, lot: MemberLot, draft: LevelDraft): Promise<DashboardLotMap> {
  const code = validatedLevelCode(draft);
  return changeLotMap(sources, lot, (operatorId) => sources.maps.addLevel(operatorId, lot.lotId, code));
}

export function reorderLevelsOfMember(sources: LotMapSources, lot: MemberLot, order: LevelOrderRequest): Promise<DashboardLotMap> {
  return changeLotMap(sources, lot, (operatorId) => sources.maps.reorderLevels(operatorId, lot.lotId, order));
}

export function addAisleOfMember(sources: LotMapSources, level: MemberLevel, request: AisleRequest): Promise<DashboardLotMap> {
  const aisle = validatedAisle(request);
  const placement = { lotId: level.lotId, levelId: level.levelId };
  return changeLotMap(sources, level, (operatorId) => sources.maps.addAisle(operatorId, placement, aisle));
}

// The server stamps the reading, so a technician's clock never makes a reading look newer or older than it is.
export function recordBeaconBatteryOfMember(sources: LotMapSources, aisle: MemberAisle, { percent }: BeaconBatteryReading): Promise<DashboardLotMap> {
  const refusal = firstFieldError(beaconBatteryErrors({ percent }));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  const placement = { lotId: aisle.lotId, aisleId: aisle.aisleId };
  return changeLotMap(sources, aisle, (operatorId) => sources.maps.recordBeaconBattery(operatorId, placement, { percent, reportedAt: sources.clock() }));
}

// Answers the whole map after the change, so the page shows what was saved, in the saved order.
async function changeLotMap(sources: LotMapSources, lot: MemberLot, write: OperatorWrite): Promise<DashboardLotMap> {
  const operatorId = await operatorIdOfMember(sources.operators, lot);
  const outcome = await write(operatorId);
  if (outcome !== LOT_MAP_WRITTEN) {
    throw new DashboardRefusedError(outcome);
  }
  return readOwnedLotMap(sources, operatorId, lot.lotId);
}

async function readOwnedLotMap({ maps, clock }: LotMapSources, operatorId: string, lotId: string): Promise<DashboardLotMap> {
  return lotMapViewOf(ownedLotOrNotFound(await maps.readLotMap(operatorId, lotId)), clock());
}

function validatedLevelCode({ code }: LevelDraft): string {
  const canonicalCode = canonicalCodeOf(code);
  const refusal = firstFieldError(levelDraftErrors({ code: canonicalCode }));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return canonicalCode;
}

// Builds the rectangle from its four sides only, so map_polygon never stores a key the read boundary would refuse.
function validatedAisle({ code, beaconMinor, rectangle }: AisleRequest): AisleDraft {
  if (rectangle === undefined || rectangle === null) {
    throw new DashboardRefusedError('AISLE_RECTANGLE_INVALID');
  }
  const { x, y, width, height } = rectangle;
  const aisle = { code: canonicalCodeOf(code), beaconMinor, rectangle: { x, y, width, height } };
  const refusal = firstFieldError(aisleDraftErrors(aisle));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return aisle;
}
