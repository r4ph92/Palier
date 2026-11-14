import { MAX_SPOTS_PER_ADD, MAX_SPOTS_PER_LOT, SPOT_DISTANCE_LIMITS, type SpotDraftErrorCode } from '@palier/shared-types/spotDraft';
import { SPOT_NUMBER_MAX_LENGTH } from '@palier/shared-types/spotNumber';
import type { LotSpotRefusal } from './LotSpotRepository.ts';

export type LotSpotReason = SpotDraftErrorCode | LotSpotRefusal | 'SPOT_NUMBER_TAKEN';

export const LOT_SPOT_MESSAGES: Readonly<Record<Exclude<LotSpotReason, 'LOT_NOT_FOUND' | 'LOT_BUSY'>, string>> = {
  AISLE_NOT_FOUND: 'No such aisle.',
  SPOT_NOT_FOUND: 'No such spot.',
  SPOT_RANGE_INVALID: `Enter a range like A-1 to A-20: the same prefix at both ends, letters, digits, spaces and dashes, from 1 up, at most ${MAX_SPOTS_PER_ADD} spots and ${SPOT_NUMBER_MAX_LENGTH} characters per number.`,
  SPOT_DISTANCE_INVALID: `The distance to the exit must be a whole number of metres from ${SPOT_DISTANCE_LIMITS.minimum} to ${SPOT_DISTANCE_LIMITS.maximum}.`,
  SPOT_LIMIT_REACHED: `A lot has at most ${MAX_SPOTS_PER_LOT} spots.`,
  SPOT_NUMBER_TAKEN: 'This number already exists in this lot.',
  SPOT_IN_USE: 'Spot in use; try again after the vehicle leaves.',
};
