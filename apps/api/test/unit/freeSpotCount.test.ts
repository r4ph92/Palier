import { describe, expect, it } from 'vitest';
import { freeSpotCount } from '../../src/domain/occupancy/freeSpotCount.ts';
import { parkingDemoAvailability } from './fakes/lotFixtures.ts';

describe('freeSpotCount', () => {
  it.each([
    [0, 10, 10],
    [8, 10, 2],
    [10, 10, 0],
    [12, 10, 0],
    [0, 9, 9],
  ])('with %i vehicles inside and %i available spots shows %i', (vehicleCount, availableSpotCount, expected) => {
    expect(freeSpotCount(parkingDemoAvailability({ vehicleCount, availableSpotCount }))).toBe(expected);
  });

  it.each([
    [1, 9, 9],
    [3, 7, 7],
    [3, 10, 7],
  ])('with %i held spots and %i available spots shows %i', (heldSpotCount, availableSpotCount, expected) => {
    expect(freeSpotCount(parkingDemoAvailability({ heldSpotCount, availableSpotCount }))).toBe(expected);
  });

  it('drops by one for a hold even when the vehicle count is the binding term', () => {
    const before = parkingDemoAvailability({ vehicleCount: 8, availableSpotCount: 10 });
    const afterOneHold = parkingDemoAvailability({ vehicleCount: 8, heldSpotCount: 1, availableSpotCount: 9 });

    expect(freeSpotCount(afterOneHold)).toBe(freeSpotCount(before) - 1);
  });

  it('is zero for a lot without capacity', () => {
    expect(freeSpotCount(parkingDemoAvailability({ capacity: 0, availableSpotCount: 0 }))).toBe(0);
  });
});
