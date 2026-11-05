import type { GeoPosition, LotListResponse, LotSummary } from '@palier/shared-types';
import { PalierUnreachableError, type LotsClient } from '../src/api/LotsClient';

export type FakeAnswer = LotListResponse | 'unreachable';

// The seeded coordinates of apps/api/src/seed/fixtures; the app cannot import the API's seed.
export const PARKING_DEMO_LOCATION: GeoPosition = { latitude: 45.50165, longitude: -73.5673 };
export const PARKING_TEST_PALIERS_LOCATION: GeoPosition = { latitude: 45.505, longitude: -73.56 };

export class FakeLotsClient implements LotsClient {
  readonly #answers: FakeAnswer[];
  callCount = 0;

  constructor(...answers: FakeAnswer[]) {
    this.#answers = answers;
  }

  listLots(): Promise<LotListResponse> {
    const answer = this.#answers[Math.min(this.callCount, this.#answers.length - 1)];
    this.callCount += 1;
    if (answer === undefined || answer === 'unreachable') {
      return Promise.reject(new PalierUnreachableError('fake'));
    }
    return Promise.resolve(answer);
  }
}

// Parking Démo as seeded (7 standard, 1 electric, 1 accessible, 1 oversize), each category capped at freeSpots.
export function parkingDemo(freeSpots: number): LotSummary {
  const capped = (count: number) => Math.min(count, freeSpots);
  return {
    id: '00000000-0000-4000-8000-000000000201',
    name: 'Parking Démo',
    freeSpots,
    freeSpotsByCategory: { standard: capped(7), electric: capped(1), accessible: capped(1), oversize: capped(1) },
    location: PARKING_DEMO_LOCATION,
  };
}

export const parkingTestPaliers: LotSummary = {
  id: '00000000-0000-4000-8000-000000000203',
  name: 'Parking Test Paliers',
  freeSpots: 5,
  freeSpotsByCategory: { standard: 5, electric: 0, accessible: 0, oversize: 0 },
  location: PARKING_TEST_PALIERS_LOCATION,
};

export function parkingDemoWith(freeSpots: number): LotListResponse {
  return [parkingDemo(freeSpots)];
}
