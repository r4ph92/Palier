import { describe, expect, it, vi } from 'vitest';
import { expireSpotHolds, type HoldExpiryJob } from '../../src/domain/spotHolds/expireSpotHolds.ts';
import type { SpotHoldRepository } from '../../src/domain/spotHolds/SpotHoldRepository.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { julie, marc } from './fakeDriverRepository.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';
import { FakeSpotHoldRepository } from './fakes/fakeSpotHolds.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const AT_14_17 = new Date('2026-11-04T19:17:00Z');
const AT_14_16_50 = new Date('2026-11-04T19:16:50Z');

function logSpy() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

async function holdingJulie(): Promise<FakeSpotHoldRepository> {
  const spotHolds = new FakeSpotHoldRepository();
  await spotHolds.placeSpotHold({ driverId: julie.id, lotId: PARKING_DEMO_ID, needs: standardNeeds, createdAt: AT_14_02, expiresAt: AT_14_17 });
  return spotHolds;
}

function jobAt(spotHolds: HoldExpiryJob['spotHolds'], now: Date): HoldExpiryJob {
  return { spotHolds, clock: () => now };
}

describe('expireSpotHolds', () => {
  it('frees the spot of a hold at the very instant it ends, and logs the count without any driver or spot', async () => {
    const spotHolds = await holdingJulie();
    const log = logSpy();

    await expireSpotHolds(jobAt(spotHolds, AT_14_17), log);

    expect(spotHolds.freedSpots).toBe(1);
    expect(await spotHolds.findActiveSpotHold(julie.id)).toBeNull();
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: PARKING_DEMO_ID, expired: 1 }, 'expired spot holds nobody used');
  });

  it('leaves a hold alone ten seconds before it ends', async () => {
    const spotHolds = await holdingJulie();
    const log = logSpy();

    await expireSpotHolds(jobAt(spotHolds, AT_14_16_50), log);

    expect(spotHolds.expiries).toEqual([]);
    expect(await spotHolds.findActiveSpotHold(julie.id)).not.toBeNull();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('reads the clock once and expires every lot at that same instant', async () => {
    const spotHolds = await holdingJulie();
    await spotHolds.placeSpotHold({ driverId: marc.id, lotId: PARKING_DEMO_ID, needs: standardNeeds, createdAt: AT_14_02, expiresAt: AT_14_02 });
    const clock = vi.fn(() => AT_14_17);

    await expireSpotHolds({ spotHolds, clock }, logSpy());

    expect(clock).toHaveBeenCalledTimes(1);
    expect(spotHolds.expiries).toEqual([{ lotId: PARKING_DEMO_ID, now: AT_14_17 }]);
    expect(spotHolds.freedSpots).toBe(2);
  });

  it('counts the spot freed once when two overlapping runs meet the fake lot lock', async () => {
    const spotHolds = await holdingJulie();
    const log = logSpy();

    await Promise.all([expireSpotHolds(jobAt(spotHolds, AT_14_17), log), expireSpotHolds(jobAt(spotHolds, AT_14_17), log)]);

    expect(spotHolds.freedSpots).toBe(1);
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('logs the failure of one lot with its id and still expires the next lot', async () => {
    const failure = new Error('lock timeout');
    const spotHolds: HoldExpiryJob['spotHolds'] = {
      findLotsWithExpiredHolds: () => Promise.resolve(['lot-busy', 'lot-calm']),
      expireLotSpotHolds: (lotId) => (lotId === 'lot-busy' ? Promise.reject(failure) : Promise.resolve({ expired: 1, freed: 1 })),
    };
    const log = logSpy();

    await expireSpotHolds(jobAt(spotHolds, AT_14_17), log);

    expect(log.error).toHaveBeenCalledExactlyOnceWith({ err: failure, lotId: 'lot-busy' }, expect.stringContaining('retried at the next check'));
    expect(log.info).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-calm', expired: 1 }, 'expired spot holds nobody used');
  });

  it('warns when an expired hold had a spot that was no longer held', async () => {
    const spotHolds: Pick<SpotHoldRepository, 'findLotsWithExpiredHolds' | 'expireLotSpotHolds'> = {
      findLotsWithExpiredHolds: () => Promise.resolve(['lot-demo']),
      expireLotSpotHolds: () => Promise.resolve({ expired: 2, freed: 1 }),
    };
    const log = logSpy();

    await expireSpotHolds(jobAt(spotHolds, AT_14_17), log);

    expect(log.warn).toHaveBeenCalledExactlyOnceWith({ lotId: 'lot-demo', expired: 2, freed: 1 }, expect.any(String));
  });
});
