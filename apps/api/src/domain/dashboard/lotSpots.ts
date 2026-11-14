import type { DashboardAisleSpots } from '@palier/shared-types';
import { firstFieldError } from '@palier/shared-types/fieldErrors';
import { addSpotsErrors, spotAttributesErrors, spotNumbersOf, type AddSpotsRequest, type SpotAttributes } from '@palier/shared-types/spotDraft';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { AislePlace, LotSpotRepository, LotSpotWrite, SpotBatch } from './LotSpotRepository.ts';
import { operatorIdOfMember, type MemberLot, type MemberOperators } from './memberOperator.ts';

export interface LotSpotSources {
  readonly operators: MemberOperators;
  readonly spots: LotSpotRepository;
}

export interface MemberAisle extends MemberLot {
  readonly aisleId: string;
}

export interface MemberSpot extends MemberLot {
  readonly spotId: string;
}

type OperatorWrite = (operatorId: string) => Promise<LotSpotWrite>;

export async function readAisleSpotsOfMember(sources: LotSpotSources, aisle: MemberAisle): Promise<DashboardAisleSpots> {
  return readOwnedAisleSpots(sources.spots, await operatorIdOfMember(sources.operators, aisle), aislePlaceOf(aisle));
}

// Each rule runs before any read, so a refused body says nothing about whether the lot or the aisle exists.
export function addSpotsOfMember(sources: LotSpotSources, aisle: MemberAisle, request: AddSpotsRequest): Promise<DashboardAisleSpots> {
  const batch = validatedBatch(request);
  return changeSpots(sources, aisle, (operatorId) => sources.spots.addSpots(operatorId, aislePlaceOf(aisle), batch));
}

export function changeSpotOfMember(sources: LotSpotSources, spot: MemberSpot, request: SpotAttributes): Promise<DashboardAisleSpots> {
  const attributes = validatedAttributes(request);
  return changeSpots(sources, spot, (operatorId) => sources.spots.changeSpot(operatorId, { lotId: spot.lotId, spotId: spot.spotId }, attributes));
}

export function removeSpotOfMember(sources: LotSpotSources, spot: MemberSpot): Promise<DashboardAisleSpots> {
  return changeSpots(sources, spot, (operatorId) => sources.spots.removeSpot(operatorId, { lotId: spot.lotId, spotId: spot.spotId }));
}

// Answers the aisle's spots after the change, so the page shows what was saved and the lot's new spot count.
async function changeSpots(sources: LotSpotSources, member: MemberLot, write: OperatorWrite): Promise<DashboardAisleSpots> {
  const operatorId = await operatorIdOfMember(sources.operators, member);
  const outcome = await write(operatorId);
  if (outcome.kind === 'refused') {
    throw new DashboardRefusedError(outcome.reason);
  }
  if (outcome.kind === 'numberTaken') {
    throw new DashboardRefusedError('SPOT_NUMBER_TAKEN', { number: outcome.takenNumber });
  }
  return readOwnedAisleSpots(sources.spots, operatorId, { lotId: member.lotId, aisleId: outcome.aisleId });
}

// Another operator's aisle, the exit lane and an aisle that does not exist give the same answer.
async function readOwnedAisleSpots(spots: LotSpotRepository, operatorId: string, aisle: AislePlace): Promise<DashboardAisleSpots> {
  const aisleSpots = await spots.readAisleSpots(operatorId, aisle);
  if (aisleSpots === null) {
    throw new DashboardRefusedError('AISLE_NOT_FOUND');
  }
  return aisleSpots;
}

function aislePlaceOf({ lotId, aisleId }: MemberAisle): AislePlace {
  return { lotId, aisleId };
}

// Builds the range and the attributes from their own keys only, so nothing else the body carried reaches the insert.
function validatedBatch({ range, attributes }: AddSpotsRequest): SpotBatch {
  const request = { range: { prefix: range.prefix, first: range.first, last: range.last }, attributes: attributesOf(attributes) };
  const refusal = firstFieldError(addSpotsErrors(request));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return { numbers: spotNumbersOf(request.range), attributes: request.attributes };
}

function validatedAttributes(request: SpotAttributes): SpotAttributes {
  const attributes = attributesOf(request);
  const refusal = firstFieldError(spotAttributesErrors(attributes));
  if (refusal !== null) {
    throw new DashboardRefusedError(refusal);
  }
  return attributes;
}

function attributesOf({ isEv, isAccessible, isOversize, distanceToExit }: SpotAttributes): SpotAttributes {
  return { isEv, isAccessible, isOversize, distanceToExit };
}
