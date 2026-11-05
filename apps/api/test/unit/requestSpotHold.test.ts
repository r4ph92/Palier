import { describe, expect, it } from 'vitest';
import type { SpotHoldRefusalCode } from '@palier/shared-types';
import { createSetupLimiter } from '../../src/http/SetupLimiter.ts';
import { requestSpotHold, type SpotHoldRequestDependencies } from '../../src/domain/spotHolds/requestSpotHold.ts';
import type { SpotHoldAttempt } from '../../src/domain/spotHolds/SpotHoldEligibility.ts';
import { SpotHoldRefusedError } from '../../src/domain/spotHolds/SpotHoldRefusedError.ts';
import { PARKING_DEMO_ID } from '../../src/seed/fixtures/parkingDemo.ts';
import { julie } from './fakeDriverRepository.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';
import { FakeSpotHoldRepository, fakeSpotHoldId } from './fakes/fakeSpotHolds.ts';

const AT_14_02 = new Date('2026-11-04T19:02:00Z');
const attempt: SpotHoldAttempt = { driverId: julie.id, lotId: PARKING_DEMO_ID };

function requestWith({ refusal = null, attemptLimit = 10 }: { refusal?: SpotHoldRefusalCode | null; attemptLimit?: number } = {}) {
  const spotHolds = new FakeSpotHoldRepository();
  spotHolds.refusal = refusal;
  let clockReadings = 0;
  const dependencies: SpotHoldRequestDependencies = {
    eligibility: { check: (checked) => Promise.resolve({ ...checked, needs: standardNeeds }) },
    spotHolds,
    attempts: createSetupLimiter(attemptLimit, 60_000),
    clock: () => {
      clockReadings += 1;
      return new Date(AT_14_02.getTime() + clockReadings - 1);
    },
  };
  return { spotHolds, dependencies, clockReadings: () => clockReadings };
}

async function reasonOf(promise: Promise<unknown>): Promise<SpotHoldRefusalCode | undefined> {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  return error instanceof SpotHoldRefusedError ? error.reason : undefined;
}

describe('requestSpotHold', () => {
  it('holds a spot taken at 14 h 02 until 14 h 17 and answers the same instant as now', async () => {
    const { dependencies } = requestWith();

    expect(await requestSpotHold(dependencies, attempt)).toEqual({
      spotHold: { id: fakeSpotHoldId(1), lotId: PARKING_DEMO_ID, lotName: 'Parking Démo', expiresAt: new Date('2026-11-04T19:17:00Z') },
      now: AT_14_02,
    });
  });

  it('reads the clock once and gives that reading to the hold it places', async () => {
    const { dependencies, spotHolds, clockReadings } = requestWith();

    await requestSpotHold(dependencies, attempt);

    expect(clockReadings()).toBe(1);
    expect(spotHolds.drafts).toEqual([{ ...attempt, needs: standardNeeds, createdAt: AT_14_02, expiresAt: new Date('2026-11-04T19:17:00Z') }]);
  });

  it('refuses once the attempt limit is used as TOO_MANY_HOLD_ATTEMPTS, without placing a hold', async () => {
    const { dependencies, spotHolds } = requestWith({ refusal: 'HOLD_QUOTA_REACHED', attemptLimit: 2 });
    await reasonOf(requestSpotHold(dependencies, attempt));
    await reasonOf(requestSpotHold(dependencies, attempt));

    expect(await reasonOf(requestSpotHold(dependencies, attempt))).toBe('TOO_MANY_HOLD_ATTEMPTS');
    expect(spotHolds.drafts).toHaveLength(2);
  });

  it('gives back the attempt of a request the busy lot turned away', async () => {
    const { dependencies } = requestWith({ refusal: 'HOLD_UNAVAILABLE', attemptLimit: 1 });
    await reasonOf(requestSpotHold(dependencies, attempt));

    expect(await reasonOf(requestSpotHold(dependencies, attempt))).toBe('HOLD_UNAVAILABLE');
  });

  it('counts a refusal under the lock against the limit', async () => {
    const { dependencies } = requestWith({ refusal: 'NO_SUITABLE_SPOT', attemptLimit: 1 });
    await reasonOf(requestSpotHold(dependencies, attempt));

    expect(await reasonOf(requestSpotHold(dependencies, attempt))).toBe('TOO_MANY_HOLD_ATTEMPTS');
  });

  it('never reads the clock for a refused eligibility', async () => {
    const { dependencies, clockReadings } = requestWith();
    const refused = { ...dependencies, eligibility: { check: () => Promise.reject(new SpotHoldRefusedError('PREREQUISITES_MISSING')) } };

    expect(await reasonOf(requestSpotHold(refused, attempt))).toBe('PREREQUISITES_MISSING');
    expect(clockReadings()).toBe(0);
  });
});
