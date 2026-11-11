import { describe, expect, it } from 'vitest';
import type { AvailableSpotGroup } from '../../src/domain/occupancy/availableByCategory.ts';
import { freeSpotCount } from '../../src/domain/occupancy/freeSpotCount.ts';
import { onlineLotFromRow, type OnlineLotRow } from '../../src/infrastructure/postgres/onlineLotRow.ts';
import { PARKING_DEMO_ID, parkingDemoLot } from '../../src/seed/fixtures/parkingDemo.ts';

const parkingDemoRow: OnlineLotRow = {
  id: PARKING_DEMO_ID,
  name: parkingDemoLot.name,
  latitude: parkingDemoLot.latitude ?? null,
  longitude: parkingDemoLot.longitude ?? null,
  capacity: 10,
  vehicleCount: 0,
  heldSpotCount: 0,
  assignedSpotCount: 0,
};

const fourThreeTwoOne: readonly AvailableSpotGroup[] = [
  { isEv: false, isAccessible: false, isOversize: false, count: 4 },
  { isEv: true, isAccessible: false, isOversize: false, count: 3 },
  { isEv: false, isAccessible: true, isOversize: false, count: 2 },
  { isEv: false, isAccessible: false, isOversize: true, count: 1 },
];

describe('onlineLotFromRow', () => {
  it('reads the numeric coordinates as numbers', () => {
    expect(onlineLotFromRow(parkingDemoRow, []).location).toEqual({ latitude: 45.50165, longitude: -73.5673 });
  });

  it('puts each flag combination in its own category and adds them up for the total', () => {
    expect(onlineLotFromRow(parkingDemoRow, fourThreeTwoOne).availability).toEqual({
      capacity: 10,
      vehicleCount: 0,
      heldSpotCount: 0,
      assignedSpotCount: 0,
      availableSpotCount: 10,
      availableByCategory: { standard: 4, electric: 3, accessible: 2, oversize: 1 },
    });
  });

  it('carries the held spots, so a lot full by capacity shows none free', () => {
    const availability = onlineLotFromRow({ ...parkingDemoRow, vehicleCount: 8, heldSpotCount: 2 }, fourThreeTwoOne).availability;

    expect(availability.heldSpotCount).toBe(2);
    expect(freeSpotCount(availability)).toBe(0);
  });

  it.each([
    ['no coordinates', null, null],
    ['a latitude without longitude', parkingDemoRow.latitude, null],
    ['a longitude without latitude', null, parkingDemoRow.longitude],
    ['a NaN latitude', 'NaN', parkingDemoRow.longitude],
    ['a latitude past the pole', '90.000001', parkingDemoRow.longitude],
    ['a longitude past the antimeridian', parkingDemoRow.latitude, '-180.5'],
  ])('gives a lot with %s no location', (_case, latitude, longitude) => {
    expect(onlineLotFromRow({ ...parkingDemoRow, latitude, longitude }, []).location).toBeNull();
  });
});
