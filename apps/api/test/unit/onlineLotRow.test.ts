import { describe, expect, it } from 'vitest';
import { onlineLotFromRow, type OnlineLotRow } from '../../src/infrastructure/postgres/onlineLotRow.ts';
import { PARKING_DEMO_ID, parkingDemoLot } from '../../src/seed/fixtures/parkingDemo.ts';

const parkingDemoRow: OnlineLotRow = {
  id: PARKING_DEMO_ID,
  name: parkingDemoLot.name,
  latitude: parkingDemoLot.latitude ?? null,
  longitude: parkingDemoLot.longitude ?? null,
  capacity: 10,
  vehicleCount: 0,
  availableSpotCount: 10,
  availableStandard: 7,
  availableElectric: 1,
  availableAccessible: 1,
  availableOversize: 1,
};

describe('onlineLotFromRow', () => {
  it('reads the numeric coordinates as numbers', () => {
    expect(onlineLotFromRow(parkingDemoRow).location).toEqual({ latitude: 45.50165, longitude: -73.5673 });
  });

  it('groups the counts into the lot availability', () => {
    expect(onlineLotFromRow(parkingDemoRow).availability).toEqual({
      capacity: 10,
      vehicleCount: 0,
      availableSpotCount: 10,
      availableByCategory: { standard: 7, electric: 1, accessible: 1, oversize: 1 },
    });
  });

  it.each([
    ['no coordinates', null, null],
    ['a latitude without longitude', parkingDemoRow.latitude, null],
    ['a longitude without latitude', null, parkingDemoRow.longitude],
  ])('gives a lot with %s no location', (_case, latitude, longitude) => {
    expect(onlineLotFromRow({ ...parkingDemoRow, latitude, longitude }).location).toBeNull();
  });
});
