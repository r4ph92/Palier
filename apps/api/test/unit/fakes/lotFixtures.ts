import type { SpotCountByCategory } from '@palier/shared-types';
import type { LotAvailabilityRepository } from '../../../src/domain/lots/LotAvailabilityRepository.ts';
import type { OnlineLot } from '../../../src/domain/lots/OnlineLot.ts';
import type { LotAvailability } from '../../../src/domain/occupancy/LotAvailability.ts';
import { PARKING_DEMO_ID, parkingDemoLot } from '../../../src/seed/fixtures/parkingDemo.ts';

export const PARKING_DEMO_CATEGORIES: SpotCountByCategory = { standard: 7, electric: 1, accessible: 1, oversize: 1 };
// Displayed once 8 vehicles are inside while every spot is free: 2 by the counter.
export const PARKING_DEMO_CATEGORIES_WITH_8_INSIDE: SpotCountByCategory = { standard: 2, electric: 1, accessible: 1, oversize: 1 };

// Parking Démo as seeded: capacity 10, nobody inside, nothing held, every spot free.
export function parkingDemoAvailability(overrides: Partial<LotAvailability> = {}): LotAvailability {
  return { capacity: 10, vehicleCount: 0, heldSpotCount: 0, assignedSpotCount: 0, availableSpotCount: 10, availableByCategory: PARKING_DEMO_CATEGORIES, ...overrides };
}

export function parkingDemoOnline(availability = parkingDemoAvailability()): OnlineLot {
  return {
    id: PARKING_DEMO_ID,
    name: 'Parking Démo',
    location: { latitude: Number(parkingDemoLot.latitude), longitude: Number(parkingDemoLot.longitude) },
    availability,
  };
}

export function repositoryReturning(lots: readonly OnlineLot[]): LotAvailabilityRepository {
  return { findOnlineLots: () => Promise.resolve(lots) };
}
