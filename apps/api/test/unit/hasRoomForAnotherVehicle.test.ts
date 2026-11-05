import { describe, expect, it } from 'vitest';
import { hasRoomForAnotherVehicle } from '../../src/domain/occupancy/hasRoomForAnotherVehicle.ts';

describe('hasRoomForAnotherVehicle', () => {
  it.each([
    [0, true],
    [9, true],
    [10, false],
    [12, false],
  ])('a lot of 10 with %i vehicles inside has room for another: %s', (vehicleCount, expected) => {
    expect(hasRoomForAnotherVehicle({ capacity: 10, vehicleCount })).toBe(expected);
  });
});
