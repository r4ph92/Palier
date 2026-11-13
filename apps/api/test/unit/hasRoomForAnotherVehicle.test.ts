import { describe, expect, it } from 'vitest';
import { hasRoomForAnotherVehicle, vehicleRoomLeft } from '../../src/domain/occupancy/hasRoomForAnotherVehicle.ts';

const nothingPromised = { heldSpotCount: 0, assignedSpotCount: 0 };

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
    expect(hasRoomForAnotherVehicle({ capacity: 10, vehicleCount, heldSpotCount, assignedSpotCount: 0 })).toBe(expected);
  });

  // #110: the count said 1 car could still fit, yet every free spot was handed out.
  it('admits Julie at count 9 of 10, then refuses Marc while her loop has not closed', () => {
    expect(hasRoomForAnotherVehicle({ capacity: 10, vehicleCount: 9, ...nothingPromised })).toBe(true);
    expect(hasRoomForAnotherVehicle({ capacity: 10, vehicleCount: 9, heldSpotCount: 0, assignedSpotCount: 1 })).toBe(false);
  });

  it('refuses a lot holding more counted vehicles than its capacity', () => {
    expect(hasRoomForAnotherVehicle({ capacity: 10, vehicleCount: 12, ...nothingPromised })).toBe(false);
  });
});

describe('vehicleRoomLeft', () => {
  it('takes a held spot off the room like a vehicle inside', () => {
    expect(vehicleRoomLeft({ capacity: 10, vehicleCount: 2, heldSpotCount: 3, assignedSpotCount: 0 })).toBe(5);
  });

  it('takes an admitted entry off the room like a vehicle inside', () => {
    expect(vehicleRoomLeft({ capacity: 10, vehicleCount: 2, heldSpotCount: 3, assignedSpotCount: 4 })).toBe(1);
  });
});
