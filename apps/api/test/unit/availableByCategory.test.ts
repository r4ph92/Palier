import { describe, expect, it } from 'vitest';
import { availableByCategory, availableSpotCount, type AvailableSpotGroup } from '../../src/domain/occupancy/availableByCategory.ts';

const STANDARD: AvailableSpotGroup = { isEv: false, isAccessible: false, isOversize: false, count: 7 };
const ELECTRIC: AvailableSpotGroup = { isEv: true, isAccessible: false, isOversize: false, count: 1 };
const ACCESSIBLE: AvailableSpotGroup = { isEv: false, isAccessible: true, isOversize: false, count: 1 };
const OVERSIZE: AvailableSpotGroup = { isEv: false, isAccessible: false, isOversize: true, count: 1 };
const ELECTRIC_AND_ACCESSIBLE: AvailableSpotGroup = { isEv: true, isAccessible: true, isOversize: false, count: 2 };

describe('availableByCategory', () => {
  it('counts Parking Démo as seeded: 7 standard, 1 electric, 1 accessible, 1 oversize', () => {
    expect(availableByCategory([STANDARD, ELECTRIC, ACCESSIBLE, OVERSIZE])).toEqual({ standard: 7, electric: 1, accessible: 1, oversize: 1 });
  });

  it('counts a spot with two flags in both categories and never as standard', () => {
    expect(availableByCategory([ELECTRIC_AND_ACCESSIBLE, ELECTRIC])).toEqual({ standard: 0, electric: 3, accessible: 2, oversize: 0 });
  });

  it('counts nothing for a lot without an available spot', () => {
    expect(availableByCategory([])).toEqual({ standard: 0, electric: 0, accessible: 0, oversize: 0 });
  });
});

describe('availableSpotCount', () => {
  it('counts a spot with two flags once', () => {
    expect(availableSpotCount([STANDARD, ELECTRIC_AND_ACCESSIBLE])).toBe(9);
  });
});
