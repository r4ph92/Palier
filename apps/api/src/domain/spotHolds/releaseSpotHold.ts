import type { Clock } from '../time/Clock.ts';
import { SpotHoldRefusedError } from './SpotHoldRefusedError.ts';
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
  await spotHolds.releaseSpotHold({ driverId, spotHoldId, lotId: spotHold.lotId, releasedAt: now });
}
