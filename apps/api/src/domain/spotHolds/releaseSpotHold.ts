import type { Clock } from '../time/Clock.ts';
import { RELEASE_UNAVAILABLE_MESSAGE, SpotHoldRefusedError } from './SpotHoldRefusedError.ts';
import type { SpotHoldRepository } from './SpotHoldRepository.ts';

export interface SpotHoldReleaseDependencies {
  readonly spotHolds: Pick<SpotHoldRepository, 'findOwnActiveSpotHold' | 'releaseSpotHold'>;
  readonly clock: Clock;
}

export interface SpotHoldReleaseAttempt {
  readonly driverId: string;
  readonly spotHoldId: string;
}

// An expired hold is left alone: its spot comes back with the expiry job (#8), so the free count never moves twice.
export async function releaseSpotHold({ spotHolds, clock }: SpotHoldReleaseDependencies, { driverId, spotHoldId }: SpotHoldReleaseAttempt): Promise<void> {
  const now = clock();
  const spotHold = await spotHolds.findOwnActiveSpotHold(driverId, spotHoldId);
  if (spotHold === null) {
    throw new SpotHoldRefusedError('HOLD_NOT_FOUND');
  }
  if (spotHold.expiresAt <= now) {
    throw new SpotHoldRefusedError('HOLD_EXPIRED');
  }
  try {
    await spotHolds.releaseSpotHold({ driverId, spotHoldId, lotId: spotHold.lotId, releasedAt: now });
  } catch (error) {
    throw releaseWordingOf(error);
  }
}

// A busy lot is worded for a release, not for placing a hold.
function releaseWordingOf(error: unknown): unknown {
  if (error instanceof SpotHoldRefusedError && error.reason === 'HOLD_UNAVAILABLE') {
    return new SpotHoldRefusedError('HOLD_UNAVAILABLE', { cause: error.cause, message: RELEASE_UNAVAILABLE_MESSAGE });
  }
  return error;
}
