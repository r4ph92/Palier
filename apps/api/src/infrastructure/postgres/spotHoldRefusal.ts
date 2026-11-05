import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import { LotBusyError } from '../../domain/entries/LotBusyError.ts';
import { SpotHoldRefusedError } from '../../domain/spotHolds/SpotHoldRefusedError.ts';
import { isLockTimeout } from './lockTimeout.ts';
import { isUniqueViolationOf } from './uniqueViolation.ts';

const ONE_ACTIVE_PER_USER = new Set(['spot_hold_one_active_per_user_index']);
const ONE_ACTIVE_PER_SPOT = new Set(['spot_hold_one_active_per_spot_index']);

// The per-user index catches two holds of one driver in two lots at once, which no single lot lock orders.
// chooseSpotFor refuses free spots that do not fit with the entry's error; a hold answers its own.
export function spotHoldRefusalOf(error: unknown, lotId: string): unknown {
  if (error instanceof EntryRefusedError && error.reason === 'NO_SUITABLE_SPOT') {
    return new SpotHoldRefusedError('NO_SUITABLE_SPOT', { cause: error });
  }
  if (isUniqueViolationOf(error, ONE_ACTIVE_PER_USER)) {
    return new SpotHoldRefusedError('HOLD_ALREADY_EXISTS', { cause: error });
  }
  if (isUniqueViolationOf(error, ONE_ACTIVE_PER_SPOT)) {
    return new SpotHoldRefusedError('HOLD_UNAVAILABLE', { cause: error });
  }
  if (isLockTimeout(error)) {
    return new SpotHoldRefusedError('HOLD_UNAVAILABLE', { cause: new LotBusyError(lotId, { cause: error }) });
  }
  return error;
}
