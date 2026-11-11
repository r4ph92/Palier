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
  describe('with entries admitted but not yet through the loop (#110)', () => {
    // Capacity 10, 9 counted vehicles, all 10 spots free: Julie's admission makes her spot ASSIGNED.
    it('shows the one place left at count 9 with 10 free spots, then 0 once Julie is admitted', () => {
      expect(freeSpotCount(parkingDemoAvailability({ vehicleCount: 9, availableSpotCount: 10 }))).toBe(1);
      expect(freeSpotCount(parkingDemoAvailability({ vehicleCount: 9, assignedSpotCount: 1, availableSpotCount: 9 }))).toBe(0);
    });

    it('shows 0, never a negative count, when two entries are admitted past the room left', () => {
      expect(freeSpotCount(parkingDemoAvailability({ vehicleCount: 9, assignedSpotCount: 2, availableSpotCount: 8 }))).toBe(0);
    });

    it('shows 0, never a negative count, when more vehicles are counted than the capacity', () => {
      expect(freeSpotCount(parkingDemoAvailability({ vehicleCount: 12, availableSpotCount: 10 }))).toBe(0);
    });

    it('gives the place back when Julie\'s entry is cancelled and her spot is free again', () => {
      const admitted = parkingDemoAvailability({ vehicleCount: 9, assignedSpotCount: 1, availableSpotCount: 9 });
      const cancelled = parkingDemoAvailability({ vehicleCount: 9, assignedSpotCount: 0, availableSpotCount: 10 });

      expect(freeSpotCount(admitted)).toBe(0);
      expect(freeSpotCount(cancelled)).toBe(1);
    });

    it('counts Julie once: 9 before and after her loop closes', () => {
      const admitted = parkingDemoAvailability({ vehicleCount: 0, assignedSpotCount: 1, availableSpotCount: 9 });
      // The loop closure adds the vehicle and moves her spot from ASSIGNED to OCCUPIED in one transaction.
      const counted = parkingDemoAvailability({ vehicleCount: 1, assignedSpotCount: 0, availableSpotCount: 9 });

      expect(freeSpotCount(admitted)).toBe(9);
      expect(freeSpotCount(counted)).toBe(9);
    });
  });
});
