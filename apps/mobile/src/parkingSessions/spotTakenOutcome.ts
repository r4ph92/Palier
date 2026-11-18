import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';

// refresh: the session moved on without this report (parked, reassigned elsewhere, closed), so the screen reads it again.
// limit: the session made all the reports it may; the driver keeps the spot and is told so.
// silent: a refused token or a missing notice already moved the app off the tabs.
// unreachable: no answer, or a busy lot; the driver can try again.
export type SpotTakenFailure = 'refresh' | 'limit' | 'silent' | 'unreachable';

export function spotTakenFailureOf(error: unknown): SpotTakenFailure {
  if (error instanceof PalierRejectedError) {
    return error.code === 'SPOT_REPORT_LIMIT' ? 'limit' : 'refresh';
  }
  if (error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError) {
    return 'silent';
  }
  if (!(error instanceof PalierUnreachableError)) {
    console.error('Reporting the assigned spot taken failed', error);
  }
  return 'unreachable';
}
