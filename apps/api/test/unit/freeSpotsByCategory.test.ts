import { describe, expect, it } from 'vitest';
import { freeSpotsByCategory } from '../../src/domain/occupancy/freeSpotsByCategory.ts';
import { PARKING_DEMO_CATEGORIES, PARKING_DEMO_CATEGORIES_WITH_8_INSIDE, parkingDemoAvailability } from './fakes/lotFixtures.ts';

describe('freeSpotsByCategory', () => {
  it('shows every available spot of each category when the lot has room', () => {
    expect(freeSpotsByCategory(parkingDemoAvailability())).toEqual(PARKING_DEMO_CATEGORIES);
  });

  it('caps each category at the displayed total when 8 vehicles are inside', () => {
    const availability = parkingDemoAvailability({ vehicleCount: 8 });

    expect(freeSpotsByCategory(availability)).toEqual(PARKING_DEMO_CATEGORIES_WITH_8_INSIDE);
  });

  it('shows zero in every category when the lot is full by its vehicle count', () => {
    const availability = parkingDemoAvailability({ vehicleCount: 10 });

    expect(freeSpotsByCategory(availability)).toEqual({ standard: 0, electric: 0, accessible: 0, oversize: 0 });
  });

  it('counts a spot flagged electric and accessible in both categories', () => {
    const availability = parkingDemoAvailability({
      availableSpotCount: 1,
      availableByCategory: { standard: 0, electric: 1, accessible: 1, oversize: 0 },
    });

    expect(freeSpotsByCategory(availability)).toEqual({ standard: 0, electric: 1, accessible: 1, oversize: 0 });
  });
});
