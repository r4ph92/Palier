import type { aisle, level, parkingLot, spot } from '../../infrastructure/postgres/schema.ts';
import { LAVOIE_OPERATOR_ID } from './operators.ts';

export const PARKING_DEMO_ID = '00000000-0000-4000-8000-000000000201';
const LEVEL_P1_ID = '00000000-0000-4000-8000-000000000301';
const AISLE_A_ID = '00000000-0000-4000-8000-000000000401';
const AISLE_B_ID = '00000000-0000-4000-8000-000000000402';
const EXIT_LANE_ID = '00000000-0000-4000-8000-000000000403';
const METRES_PER_SPOT_FROM_EXIT = 5;
const VERIFIED_AT = new Date('2026-10-01T12:00:00Z');

type SpotFixture = typeof spot.$inferInsert;
type SpotFeature = Pick<SpotFixture, 'isEv' | 'isAccessible' | 'isOversize'>;

interface DemoAisle {
  readonly id: string;
  readonly code: string;
}

const AISLE_A: DemoAisle = { id: AISLE_A_ID, code: 'A' };
const AISLE_B: DemoAisle = { id: AISLE_B_ID, code: 'B' };

export const parkingDemoLot: typeof parkingLot.$inferInsert = {
  id: PARKING_DEMO_ID,
  operatorId: LAVOIE_OPERATOR_ID,
  name: 'Parking Démo',
  beaconMajor: 1,
  pricingPolicy: { incrementCents: 75, incrementMinutes: 15, holdQuota: 3 },
  dailyCapCents: 2500,
  capacity: 10,
  vehicleCount: 0,
  isOnline: true,
  wifiVerifiedAt: VERIFIED_AT,
  cellVerifiedAt: VERIFIED_AT,
};

export const parkingDemoLevels: (typeof level.$inferInsert)[] = [
  { id: LEVEL_P1_ID, lotId: PARKING_DEMO_ID, code: 'P1', displayOrder: 1 },
];

export const parkingDemoAisles: (typeof aisle.$inferInsert)[] = [
  { id: AISLE_A_ID, levelId: LEVEL_P1_ID, lotId: PARKING_DEMO_ID, code: 'A', beaconMinor: 1 },
  { id: AISLE_B_ID, levelId: LEVEL_P1_ID, lotId: PARKING_DEMO_ID, code: 'B', beaconMinor: 2 },
  { id: EXIT_LANE_ID, levelId: LEVEL_P1_ID, lotId: PARKING_DEMO_ID, code: 'Sortie', beaconMinor: 0, isExitLane: true },
];

export const parkingDemoSpots: SpotFixture[] = [
  demoSpot(AISLE_A, 1),
  demoSpot(AISLE_A, 2),
  demoSpot(AISLE_A, 3),
  demoSpot(AISLE_A, 4),
  demoSpot(AISLE_A, 5, { isEv: true }),
  demoSpot(AISLE_B, 1),
  demoSpot(AISLE_B, 2),
  demoSpot(AISLE_B, 3),
  demoSpot(AISLE_B, 4, { isOversize: true }),
  demoSpot(AISLE_B, 5, { isAccessible: true }),
];

function demoSpot(aisle: DemoAisle, position: number, feature: SpotFeature = {}): SpotFixture {
  return {
    aisleId: aisle.id,
    lotId: PARKING_DEMO_ID,
    number: `${aisle.code}-${position}`,
    distanceToExit: METRES_PER_SPOT_FROM_EXIT * position,
    ...feature,
  };
}
