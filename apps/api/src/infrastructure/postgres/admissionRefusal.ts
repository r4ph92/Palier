import { EntryRefusedError } from '../../domain/entries/EntryRefusedError.ts';
import { LotBusyError } from '../../domain/lots/LotBusyError.ts';
import { isActiveSessionConflict } from './activeSessionConflict.ts';
import { isLockTimeout } from './lockTimeout.ts';

// PAYMENTS_UNAVAILABLE for a lock timeout: it is the one retryable 503 the app already explains to the driver.
export function admissionRefusalOf(error: unknown, lotId: string): unknown {
  if (isActiveSessionConflict(error)) {
    return new EntryRefusedError('ALREADY_INSIDE', { cause: error });
  }
  if (isLockTimeout(error)) {
    return new EntryRefusedError('PAYMENTS_UNAVAILABLE', { cause: new LotBusyError(lotId, { cause: error }) });
  }
  return error;
}
