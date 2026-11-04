import { describe, expect, it } from 'vitest';
import type { LotAvailability } from '../../src/domain/occupancy/LotAvailability.ts';
import { freeSpotCount } from '../../src/domain/occupancy/freeSpotCount.ts';

function parkingDemo(vehicleCount: number, availableSpotCount: number): LotAvailability {
  return { id: 'lot', name: 'Parking Démo', capacity: 10, vehicleCount, availableSpotCount };
}

describe('freeSpotCount', () => {
  it.each([
    [0, 10, 10],
    [8, 10, 2],
    [10, 10, 0],
    [12, 10, 0],
    [0, 9, 9],
  ])('with %i vehicles inside and %i available spots shows %i', (vehicleCount, availableSpotCount, expected) => {
    expect(freeSpotCount(parkingDemo(vehicleCount, availableSpotCount))).toBe(expected);
  });

  it('is zero for a lot without capacity', () => {
    const availability = { id: 'lot', name: 'Vide', capacity: 0, vehicleCount: 0, availableSpotCount: 0 };

    expect(freeSpotCount(availability)).toBe(0);
  });
});
