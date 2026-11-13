import type { DashboardLotMap, LevelOrderRequest } from '@palier/shared-types';
import { aisleDraftErrors, type AisleDraft, type AisleRequest } from '@palier/shared-types/aisleDraft';
import { canonicalCodeOf } from '@palier/shared-types/displayText';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { levelDraftErrors, type LevelDraft } from '@palier/shared-types/levelDraft';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { LotMapRepository, LotMapWrite } from './LotMapRepository.ts';
import type { OperatorRepository } from './OperatorRepository.ts';

export interface LotMapSources {
  readonly operators: Pick<OperatorRepository, 'findOperatorOfMember'>;
  readonly maps: LotMapRepository;
}

export interface MemberLot {
  readonly userId: string;
  readonly lotId: string;
}

export interface MemberLevel extends MemberLot {
  readonly levelId: string;
}

// Read like a missing rectangle: the rule refuses it as AISLE_RECTANGLE_INVALID.
const NO_RECTANGLE = { x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN } as const;

// Another operator's lot and a lot that does not exist give the same answer, so ids reveal nothing.
export async function readLotMapOfMember({ operators, maps }: LotMapSources, { userId, lotId }: MemberLot): Promise<DashboardLotMap> {
  const operator = await operators.findOperatorOfMember(userId);
  const map = operator === null ? null : await maps.readLotMap(operator.id, lotId);
  if (map === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  return map;
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

// Answers the whole map after the change, so the page shows what was saved, in the saved order.
async function changeLotMap(sources: LotMapSources, lot: MemberLot, write: (operatorId: string) => Promise<LotMapWrite>): Promise<DashboardLotMap> {
  const operator = await sources.operators.findOperatorOfMember(lot.userId);
  const refusal = operator === null ? 'LOT_NOT_FOUND' : await write(operator.id);
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return readLotMapOfMember(sources, lot);
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
function validatedAisle({ code, beaconMinor, rectangle = null }: AisleRequest): AisleDraft {
  const { x, y, width, height } = rectangle ?? NO_RECTANGLE;
  const aisle = { code: canonicalCodeOf(code), beaconMinor, rectangle: { x, y, width, height } };
  const refusal = firstFieldError(aisleDraftErrors(aisle));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return aisle;
}
