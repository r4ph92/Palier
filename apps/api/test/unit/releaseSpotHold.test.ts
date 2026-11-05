import { describe, expect, it } from 'vitest';
import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { releaseSpotHold, type SpotHoldReleaseDependencies } from '../../src/domain/spotHolds/releaseSpotHold.ts';
import { SpotHoldRefusedError } from '../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { julie, marc } from './fakeDriverRepository.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';
import { FakeSpotHoldRepository, fakeSpotHoldId } from './fakes/fakeSpotHolds.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const AT_14_10 = new Date('2026-11-04T19:10:00Z');
const AT_14_17 = new Date('2026-11-04T19:17:00Z');

async function holdingJulie(now: Date) {
  const spotHolds = new FakeSpotHoldRepository();
  await spotHolds.placeSpotHold({
    driverId: julie.id,
    lotId: PARKING_DEMO_ID,
    needs: standardNeeds,
    createdAt: AT_14_02,
    expiresAt: AT_14_17,
  });
  let clockReadings = 0;
  const dependencies: SpotHoldReleaseDependencies = {
    spotHolds,
    clock: () => {
      clockReadings += 1;
      return now;
    },
  };
  return { spotHolds, dependencies, clockReadings: () => clockReadings };
}

async function reasonOf(promise: Promise<unknown>): Promise<SpotHoldRefusalCode | undefined> {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  return error instanceof SpotHoldRefusedError ? error.reason : undefined;
}

describe('releaseSpotHold', () => {
  it('releases Julie\'s hold at the one clock reading of the request', async () => {
    const { dependencies, spotHolds, clockReadings } = await holdingJulie(AT_14_10);

    await releaseSpotHold(dependencies, { driverId: julie.id, spotHoldId: fakeSpotHoldId(1) });

    expect(spotHolds.releases).toEqual([{ driverId: julie.id, spotHoldId: fakeSpotHoldId(1), lotId: PARKING_DEMO_ID, releasedAt: AT_14_10 }]);
    expect(clockReadings()).toBe(1);
  });

  it('answers HOLD_NOT_FOUND to Marc asking for Julie\'s hold, and releases nothing', async () => {
    const { dependencies, spotHolds } = await holdingJulie(AT_14_10);

    expect(await reasonOf(releaseSpotHold(dependencies, { driverId: marc.id, spotHoldId: fakeSpotHoldId(1) }))).toBe('HOLD_NOT_FOUND');
    expect(spotHolds.releases).toHaveLength(0);
  });

  it('answers HOLD_NOT_FOUND to an unknown hold id', async () => {
    const { dependencies } = await holdingJulie(AT_14_10);

    expect(await reasonOf(releaseSpotHold(dependencies, { driverId: julie.id, spotHoldId: fakeSpotHoldId(99) }))).toBe('HOLD_NOT_FOUND');
  });

  it.each([
    ['at the second it lapses', AT_14_17],
    ['after it lapsed', new Date('2026-11-04T19:40:00Z')],
  ])('answers HOLD_EXPIRED %s and leaves the hold and its spot alone', async (_case, now) => {
    const { dependencies, spotHolds } = await holdingJulie(now);

    expect(await reasonOf(releaseSpotHold(dependencies, { driverId: julie.id, spotHoldId: fakeSpotHoldId(1) }))).toBe('HOLD_EXPIRED');
    expect(spotHolds.releases).toHaveLength(0);
  });

  it('lets a lock timeout through as HOLD_UNAVAILABLE', async () => {
    const { dependencies, spotHolds } = await holdingJulie(AT_14_10);
    spotHolds.refusal = 'HOLD_UNAVAILABLE';

    expect(await reasonOf(releaseSpotHold(dependencies, { driverId: julie.id, spotHoldId: fakeSpotHoldId(1) }))).toBe('HOLD_UNAVAILABLE');
  });
});
