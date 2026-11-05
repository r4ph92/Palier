import type { Clock } from '../time/Clock.ts';
import type { SpotHold } from './SpotHold.ts';
import type { SpotHoldAttempt, SpotHoldEligibility } from './SpotHoldEligibility.ts';
import { SpotHoldRefusedError } from './SpotHoldRefusedError.ts';
import type { SpotHoldRepository } from './SpotHoldRepository.ts';
import { spotHoldExpiry } from './spotHoldRules.ts';

export interface SpotHoldAttemptLimiter {
  allow(driverId: string): boolean;
  refund(driverId: string): void;
}

export interface SpotHoldRequestDependencies {
  readonly eligibility: Pick<SpotHoldEligibility, 'check'>;
  readonly spotHolds: Pick<SpotHoldRepository, 'placeSpotHold'>;
  readonly attempts: SpotHoldAttemptLimiter;
  readonly clock: Clock;
}

// now is the one clock reading of the request: the hold's instants and the answer's now all come from it.
export interface PlacedSpotHold {
  readonly spotHold: SpotHold;
  readonly now: Date;
}

export async function requestSpotHold(dependencies: SpotHoldRequestDependencies, attempt: SpotHoldAttempt): Promise<PlacedSpotHold> {
  const eligible = await dependencies.eligibility.check(attempt);
  if (!dependencies.attempts.allow(attempt.driverId)) {
    throw new SpotHoldRefusedError('TOO_MANY_HOLD_ATTEMPTS');
  }
  const now = dependencies.clock();
  try {
    const spotHold = await dependencies.spotHolds.placeSpotHold({ ...eligible, createdAt: now, expiresAt: spotHoldExpiry(now) });
    return { spotHold, now };
  } catch (error) {
    refundRetryableAttempt(dependencies.attempts, attempt.driverId, error);
    throw error;
  }
}

// A busy lot is not the driver's doing: that attempt does not count against them.
function refundRetryableAttempt(attempts: SpotHoldAttemptLimiter, driverId: string, error: unknown): void {
  if (error instanceof SpotHoldRefusedError && error.reason === 'HOLD_UNAVAILABLE') {
    attempts.refund(driverId);
  }
}
