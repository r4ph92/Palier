import { describe, expect, it } from 'vitest';
import { hasRoomForAnotherVehicle, vehicleRoomLeft } from '../../src/domain/occupancy/hasRoomForAnotherVehicle.ts';

describe('hasRoomForAnotherVehicle', () => {
  it.each([
    [0, 0, true],
    [9, 0, true],
    [10, 0, false],
    [12, 0, false],
    [7, 2, true],
    [7, 3, false],
    [0, 10, false],
  ])('a lot of 10 with %i vehicles inside and %i held spots has room for another: %s', (vehicleCount, heldSpotCount, expected) => {
    expect(hasRoomForAnotherVehicle({ capacity: 10, vehicleCount, heldSpotCount })).toBe(expected);
  });
});

describe('vehicleRoomLeft', () => {
  it('takes a held spot off the room like a vehicle inside', () => {
    expect(vehicleRoomLeft({ capacity: 10, vehicleCount: 2, heldSpotCount: 3 })).toBe(5);
  });
});
