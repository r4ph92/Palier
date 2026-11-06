import { describe, expect, it } from 'vitest';
import type { FreeSpot } from '../../src/domain/allocation/chooseSpot.ts';
import { admissibleSpotCount } from '../../src/load/admissibleSpotCount.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';

const spot = (number: string, isEv = false): FreeSpot => ({
  id: `spot-${number}`,
  number,
  levelOrder: 1,
  aisleId: 'aisle-A',
  aisleCode: 'A',
  distanceToExit: 5,
  needsCheck: false,
  isEv,
  isAccessible: false,
  isOversize: false,
});

const freeSpots = [spot('A-1'), spot('A-2'), spot('A-3', true)];

describe('admissibleSpotCount', () => {
  it('counts the free spots a standard vehicle may take when the lot has room', () => {
    expect(admissibleSpotCount({ occupancy: { capacity: 10, vehicleCount: 0, heldSpotCount: 0 }, freeSpots, needs: standardNeeds })).toBe(2);
  });

  it('admits nobody once vehicles and held spots fill the lot, though spots look free', () => {
    expect(admissibleSpotCount({ occupancy: { capacity: 10, vehicleCount: 7, heldSpotCount: 3 }, freeSpots, needs: standardNeeds })).toBe(0);
  });
});
