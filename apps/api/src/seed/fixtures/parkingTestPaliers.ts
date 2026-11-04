import type { aisle, level, parkingLot, spot } from '../../infrastructure/postgres/schema.ts';
import { LAVOIE_OPERATOR_ID } from './operators.ts';
import { SEEDED_PRICING_POLICY } from './pricing.ts';

export const PARKING_TEST_PALIERS_ID = '00000000-0000-4000-8000-000000000203';
const LEVEL_P1_ID = '00000000-0000-4000-8000-000000000302';
const LEVEL_P2_ID = '00000000-0000-4000-8000-000000000303';
const AISLE_A_ID = '00000000-0000-4000-8000-000000000404';
const AISLE_C_ID = '00000000-0000-4000-8000-000000000405';
const AISLE_D_ID = '00000000-0000-4000-8000-000000000406';
const VERIFIED_AT = new Date('2026-10-01T12:00:00Z');

type SpotFixture = typeof spot.$inferInsert;

// A-1 holds a car, so P1 has one free spot and P2 has four: the first level with a free spot must still win.
export const parkingTestPaliersLot: typeof parkingLot.$inferInsert = {
  id: PARKING_TEST_PALIERS_ID,
  operatorId: LAVOIE_OPERATOR_ID,
  name: 'Parking Test Paliers',
  beaconMajor: 3,
  pricingPolicy: SEEDED_PRICING_POLICY,
  dailyCapCents: 2500,
  capacity: 6,
  vehicleCount: 1,
  isOnline: true,
  wifiVerifiedAt: VERIFIED_AT,
  cellVerifiedAt: VERIFIED_AT,
};

export const parkingTestPaliersLevels: (typeof level.$inferInsert)[] = [
  { id: LEVEL_P1_ID, lotId: PARKING_TEST_PALIERS_ID, code: 'P1', displayOrder: 1 },
  { id: LEVEL_P2_ID, lotId: PARKING_TEST_PALIERS_ID, code: 'P2', displayOrder: 2 },
];

export const parkingTestPaliersAisles: (typeof aisle.$inferInsert)[] = [
  { id: AISLE_A_ID, levelId: LEVEL_P1_ID, lotId: PARKING_TEST_PALIERS_ID, code: 'A', beaconMinor: 1 },
  { id: AISLE_C_ID, levelId: LEVEL_P2_ID, lotId: PARKING_TEST_PALIERS_ID, code: 'C', beaconMinor: 2 },
  { id: AISLE_D_ID, levelId: LEVEL_P2_ID, lotId: PARKING_TEST_PALIERS_ID, code: 'D', beaconMinor: 3 },
];

export const parkingTestPaliersSpots: SpotFixture[] = [
  { ...paliersSpot(AISLE_A_ID, 'A-1', 5), state: 'OCCUPIED' },
  paliersSpot(AISLE_A_ID, 'A-2', 10),
  paliersSpot(AISLE_C_ID, 'C-1', 10),
  paliersSpot(AISLE_C_ID, 'C-2', 5),
  paliersSpot(AISLE_C_ID, 'C-3', 15),
  paliersSpot(AISLE_D_ID, 'D-1', 5),
];

function paliersSpot(aisleId: string, number: string, distanceToExit: number): SpotFixture {
  return { aisleId, lotId: PARKING_TEST_PALIERS_ID, number, distanceToExit };
}
