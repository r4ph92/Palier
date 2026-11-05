import type { JobLog } from '../JobLog.ts';
import type { Clock } from '../time/Clock.ts';
import type { SpotHoldRepository } from './SpotHoldRepository.ts';

export interface HoldExpiryJob {
  readonly spotHolds: Pick<SpotHoldRepository, 'findLotsWithExpiredHolds' | 'expireLotSpotHolds'>;
  readonly clock: Clock;
}

// One clock reading per run and one transaction per lot: a lot that cannot be locked waits for the next run, the others still expire.
export async function expireSpotHolds({ spotHolds, clock }: HoldExpiryJob, log: JobLog): Promise<void> {
  const now = clock();
  for (const lotId of await spotHolds.findLotsWithExpiredHolds(now)) {
    await expireLot(spotHolds, { lotId, now }, log);
  }
}

interface LotExpiry {
  readonly lotId: string;
  readonly now: Date;
}

async function expireLot(spotHolds: HoldExpiryJob['spotHolds'], { lotId, now }: LotExpiry, log: JobLog): Promise<void> {
  try {
    const { expired, freed } = await spotHolds.expireLotSpotHolds(lotId, now);
    if (expired > 0) {
      log.info({ lotId, expired }, 'expired spot holds nobody used');
    }
    if (freed < expired) {
      log.warn({ lotId, expired, freed }, 'an expired spot hold had a spot that was no longer held');
    }
  } catch (error) {
    log.error({ err: error, lotId }, 'could not expire the spot holds of a lot, retried at the next check');
  }
}
