import { PalierUnauthorizedError } from '../api/AuthClient';
import { PalierStatusError, PalierUnreachableError } from '../api/LotsClient';
import { PalierConsentRequiredError, PalierRejectedError } from '../api/VehicleClient';
import { SPOT_HOLD_REFUSALS, type SpotHoldRefusal } from './spotHoldRefusals';

export type SpotHoldFailureReason =
  | { readonly kind: 'refused'; readonly refusal: SpotHoldRefusal }
  | { readonly kind: 'notResponding' }
  | { readonly kind: 'unreachable' };

export interface SpotHoldFailure {
  readonly reason: SpotHoldFailureReason;
  // True until VoiceOver has announced it once: a tab return shows it again without a second announcement.
  readonly isFresh: boolean;
}

// A status error is checked before the network error it extends: the API answered, so the connection is fine.
// A refused token or a missing notice already moves the app off the tabs.
export function failureReasonOf(error: unknown): SpotHoldFailureReason | null {
  if (error instanceof PalierRejectedError) {
    return isSpotHoldRefusal(error.code) ? { kind: 'refused', refusal: error.code } : { kind: 'notResponding' };
  }
  if (error instanceof PalierStatusError) {
    return { kind: 'notResponding' };
  }
  if (error instanceof PalierUnreachableError) {
    return { kind: 'unreachable' };
  }
  if (error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError) {
    return null;
  }
  throw error;
}

// Without network the hold is simply not known yet: the next lots refresh reads it again.
export function isExpectedReadFailure(error: unknown): boolean {
  return error instanceof PalierUnreachableError || error instanceof PalierUnauthorizedError || error instanceof PalierConsentRequiredError;
}

function isSpotHoldRefusal(code: string): code is SpotHoldRefusal {
  return (SPOT_HOLD_REFUSALS as readonly string[]).includes(code);
}
