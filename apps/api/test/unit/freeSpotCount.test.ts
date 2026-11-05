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

  it('is zero for a lot without capacity', () => {
    expect(freeSpotCount(parkingDemoAvailability({ capacity: 0, availableSpotCount: 0 }))).toBe(0);
  });
});
