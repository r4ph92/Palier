import { describe, expect, it } from 'vitest';
import type { FreeSpot } from '../../src/domain/allocation/chooseSpot.ts';
import { admissibleSpotCount } from '../../src/load/admissibleSpotCount.ts';
import { standardNeeds } from './fakeVehicleRepository.ts';
import { freeSpotFixture } from './fakes/freeSpotFixture.ts';

const spot = (number: string, isEv = false): FreeSpot => freeSpotFixture(number, { id: `spot-${number}`, aisleId: 'aisle-A', aisleCode: 'A', distanceToExit: 5, isEv });

const freeSpots = [spot('A-1'), spot('A-2'), spot('A-3', true)];

describe('admissibleSpotCount', () => {
  it('counts the free spots a standard vehicle may take when the lot has room', () => {
    expect(admissibleSpotCount({ occupancy: { capacity: 10, vehicleCount: 0, heldSpotCount: 0, assignedSpotCount: 0 }, freeSpots, needs: standardNeeds })).toBe(2);
  });

  it('admits nobody once vehicles and held spots fill the lot, though spots look free', () => {
    expect(admissibleSpotCount({ occupancy: { capacity: 10, vehicleCount: 7, heldSpotCount: 3, assignedSpotCount: 0 }, freeSpots, needs: standardNeeds })).toBe(0);
  });

  // #110: capacity 10, 9 counted vehicles, all 10 spots free: the free count shown is 1, so is the expectation.
  it('expects one admission when the counted vehicles leave room for one, though every spot is free', () => {
    const allFree = Array.from({ length: 10 }, (_, index) => spot(`A-${index + 1}`));

    expect(admissibleSpotCount({ occupancy: { capacity: 10, vehicleCount: 9, heldSpotCount: 0, assignedSpotCount: 0 }, freeSpots: allFree, needs: standardNeeds })).toBe(1);
  });

  it('takes admitted entries off the expectation and never goes below zero', () => {
    expect(admissibleSpotCount({ occupancy: { capacity: 10, vehicleCount: 8, heldSpotCount: 0, assignedSpotCount: 1 }, freeSpots, needs: standardNeeds })).toBe(1);
    expect(admissibleSpotCount({ occupancy: { capacity: 10, vehicleCount: 12, heldSpotCount: 0, assignedSpotCount: 0 }, freeSpots, needs: standardNeeds })).toBe(0);
  });
});
