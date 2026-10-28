import { describe, expect, it } from 'vitest';
import { freeSpotCount } from '../../src/domain/occupancy/freeSpotCount.ts';

describe('freeSpotCount', () => {
  it('counts the available spots of the lot', () => {
    const availability = { id: 'lot', name: 'Parking Démo', capacity: 10, vehicleCount: 0, availableSpotCount: 9 };

    expect(freeSpotCount(availability)).toBe(9);
  });

  it('is zero for a lot without available spots', () => {
    const availability = { id: 'lot', name: 'Vide', capacity: 0, vehicleCount: 0, availableSpotCount: 0 };

    expect(freeSpotCount(availability)).toBe(0);
  });
});
