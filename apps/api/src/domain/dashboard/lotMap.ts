import type { DashboardLotMap, LevelOrderRequest } from '@palier/shared-types';
import { aisleDraftErrors, type AisleDraft, type AisleRequest } from '@palier/shared-types/aisleDraft';
import { canonicalCodeOf } from '@palier/shared-types/displayText';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { levelDraftErrors, type LevelDraft } from '@palier/shared-types/levelDraft';
import { EXIT_LANE_CODE } from '../lots/exitLane.ts';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import { LOT_MAP_WRITTEN, type LotMapRepository, type LotMapWrite } from './LotMapRepository.ts';
import { operatorIdOfMember, type MemberLot, type MemberOperators } from './memberOperator.ts';

export interface LotMapSources {
  readonly operators: MemberOperators;
  readonly maps: LotMapRepository;
}

export interface MemberLevel extends MemberLot {
  readonly levelId: string;
}

type AisleWrite = LotMapWrite | 'AISLE_CODE_RESERVED';
type OperatorWrite = (operatorId: string) => Promise<AisleWrite>;

export async function readLotMapOfMember(sources: LotMapSources, lot: MemberLot): Promise<DashboardLotMap> {
  return readOwnedLotMap(sources.maps, await operatorIdOfMember(sources.operators, lot), lot.lotId);
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
  return changeLotMap(sources, level, async (operatorId) => reservedWhenExitLaneCode(await sources.maps.addAisle(operatorId, placement, aisle), aisle.code));
}

// The level's exit lane holds its code, which the dashboard never shows: the operator is told why, rather than "taken".
function reservedWhenExitLaneCode(outcome: LotMapWrite, code: string): AisleWrite {
  return outcome === 'AISLE_CODE_TAKEN' && code === EXIT_LANE_CODE ? 'AISLE_CODE_RESERVED' : outcome;
}

// Answers the whole map after the change, so the page shows what was saved, in the saved order.
async function changeLotMap(sources: LotMapSources, lot: MemberLot, write: OperatorWrite): Promise<DashboardLotMap> {
  const operatorId = await operatorIdOfMember(sources.operators, lot);
  const outcome = await write(operatorId);
  if (outcome !== LOT_MAP_WRITTEN) {
    throw new DashboardRefusedError(outcome);
  }
  return readOwnedLotMap(sources.maps, operatorId, lot.lotId);
}

// Another operator's lot and a lot that does not exist give the same answer, so ids reveal nothing.
async function readOwnedLotMap(maps: LotMapRepository, operatorId: string, lotId: string): Promise<DashboardLotMap> {
  const map = await maps.readLotMap(operatorId, lotId);
  if (map === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  return map;
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
