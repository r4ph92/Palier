import type { parkingLot } from '../../infrastructure/postgres/schema.ts';
import { LAVOIE_OPERATOR_ID } from './operators.ts';
import { SEEDED_PRICING_POLICY } from './pricing.ts';

export const PARKING_TEST_PALIERS_ID = '00000000-0000-4000-8000-000000000203';

// Only the lot row for now, so Sophie's dashboard lists two lots; its levels, spots and gate come with the allocation tests.
export const parkingTestPaliersLot: typeof parkingLot.$inferInsert = {
  id: PARKING_TEST_PALIERS_ID,
  operatorId: LAVOIE_OPERATOR_ID,
  name: 'Parking Test Paliers',
  pricingPolicy: SEEDED_PRICING_POLICY,
  dailyCapCents: 2500,
  capacity: 0,
  isOnline: false,
};
