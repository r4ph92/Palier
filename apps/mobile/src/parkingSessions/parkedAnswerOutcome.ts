import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';

export type ParkedAnswerProblem = 'UNKNOWN_SPOT' | 'SPOT_TAKEN' | 'SPOT_OUT_OF_SERVICE' | 'INVALID_NUMBER' | 'UNREACHABLE';

// refresh: the session moved on without this answer (answered elsewhere, closed), so the screen reads it again.
// silent: a refused token or a missing notice already moved the app off the tabs.
export type ParkedAnswerOutcome = { readonly kind: 'problem'; readonly problem: ParkedAnswerProblem } | { readonly kind: 'refresh' } | { readonly kind: 'silent' };

const PROBLEM_CODES: Readonly<Record<string, ParkedAnswerProblem>> = {
  UNKNOWN_SPOT: 'UNKNOWN_SPOT',
  SPOT_TAKEN: 'SPOT_TAKEN',
  SPOT_OUT_OF_SERVICE: 'SPOT_OUT_OF_SERVICE',
};

const BAD_REQUEST = 400;

export function parkedAnswerOutcomeOf(error: unknown): ParkedAnswerOutcome {
  if (error instanceof PalierRejectedError) {
    const problem = PROBLEM_CODES[error.code];
    return problem === undefined ? { kind: 'refresh' } : { kind: 'problem', problem };
  }
  if (error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError) {
    return { kind: 'silent' };
  }
  if (error instanceof PalierStatusError && error.status === BAD_REQUEST) {
    return { kind: 'problem', problem: 'INVALID_NUMBER' };
  }
  if (!(error instanceof PalierUnreachableError)) {
    console.error('Answering where the car is parked failed', error);
  }
  return { kind: 'problem', problem: 'UNREACHABLE' };
}
