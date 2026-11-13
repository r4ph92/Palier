import { AISLE_CODE_LENGTH, type AisleDraftErrorCode } from '@palier/shared-types/aisleDraft';
import { AISLE_GRID_LIMIT } from '@palier/shared-types/aisleRectangle';
import { AISLE_MINOR_LIMITS } from '@palier/shared-types/beacons';
import { LEVEL_CODE_LENGTH, MAX_LEVELS_PER_LOT, type LevelDraftErrorCode } from '@palier/shared-types/levelDraft';
import type { LotMapRefusal } from './LotMapRepository.ts';

export const LOT_MAP_MESSAGES: Readonly<Record<LevelDraftErrorCode | AisleDraftErrorCode | Exclude<LotMapRefusal, 'LOT_NOT_FOUND'>, string>> = {
  LEVEL_CODE_INVALID: `The level code must be ${LEVEL_CODE_LENGTH.minimum} to ${LEVEL_CODE_LENGTH.maximum} characters, with no invisible characters.`,
  LEVEL_CODE_TAKEN: 'This lot already has a level with this code.',
  LEVEL_LIMIT_REACHED: `A lot has at most ${MAX_LEVELS_PER_LOT} levels.`,
  LEVEL_ORDER_INVALID: 'The order must move one level by one place from the current order; reload the map.',
  LEVEL_NOT_FOUND: 'No such level.',
  AISLE_CODE_INVALID: `The aisle code must be ${AISLE_CODE_LENGTH.minimum} to ${AISLE_CODE_LENGTH.maximum} characters, with no invisible characters.`,
  AISLE_CODE_TAKEN: 'This level already has an aisle with this code.',
  AISLE_MINOR_INVALID: `The beacon minor must be a whole number from ${AISLE_MINOR_LIMITS.minimum} to ${AISLE_MINOR_LIMITS.maximum}; 0 is the exit lane's.`,
  AISLE_MINOR_TAKEN: 'Another aisle of this lot already uses this beacon minor.',
  AISLE_RECTANGLE_INVALID: `The rectangle needs x and y from 0 to ${AISLE_GRID_LIMIT}, and a width and a height above 0 up to ${AISLE_GRID_LIMIT}.`,
  LOT_BUSY: 'The parking lot is busy; try again.',
};
