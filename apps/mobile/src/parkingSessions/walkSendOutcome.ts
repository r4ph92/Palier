import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';

// keep: send it again later; drop: Palier answered for good; unexpected: drop it too, but say so in the log.
export type WalkSendOutcome = 'keep' | 'drop' | 'unexpected';

const FIRST_SERVER_ERROR = 500;

// Ordered: a PalierStatusError is also a PalierUnreachableError, and only a server error is worth sending again.
// A refused token or a missing notice keeps the walk for after the driver signs in again or accepts the notice.
export function walkSendOutcome(error: unknown): WalkSendOutcome {
  if (error instanceof PalierStatusError) {
    return error.status >= FIRST_SERVER_ERROR ? 'keep' : 'drop';
  }
  if (error instanceof PalierUnreachableError || error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError) {
    return 'keep';
  }
  return error instanceof PalierRejectedError ? 'drop' : 'unexpected';
}
