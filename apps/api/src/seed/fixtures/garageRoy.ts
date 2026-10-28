import type { parkingLot } from '../../infrastructure/postgres/schema.ts';
import { ROY_OPERATOR_ID } from './operators.ts';

export const GARAGE_ROY_ID = '00000000-0000-4000-8000-000000000202';

export const garageRoyLot: typeof parkingLot.$inferInsert = {
  id: GARAGE_ROY_ID,
  operatorId: ROY_OPERATOR_ID,
  name: 'Garage Roy',
  dailyCapCents: 2500,
  capacity: 0,
  isOnline: false,
};
