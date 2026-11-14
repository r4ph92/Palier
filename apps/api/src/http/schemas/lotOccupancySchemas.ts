import type { DashboardLotOccupancy } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';

const count = { type: 'integer' } as const;

const spotCountsSchema = {
  type: 'object',
  required: ['AVAILABLE', 'HELD', 'ASSIGNED', 'OCCUPIED', 'OCCUPIED_UNKNOWN', 'OUT_OF_SERVICE'],
  additionalProperties: false,
  properties: { AVAILABLE: count, HELD: count, ASSIGNED: count, OCCUPIED: count, OCCUPIED_UNKNOWN: count, OUT_OF_SERVICE: count },
} as const;

export const dashboardLotOccupancySchema = {
  type: 'object',
  required: ['lotId', 'lotName', 'vehicleCount', 'levels', 'occupiedOrAssignedCount', 'counterGap', 'silentGateNames'],
  additionalProperties: false,
  properties: {
    lotId: { type: 'string' },
    lotName: { type: 'string' },
    vehicleCount: count,
    levels: {
      type: 'array',
      items: { type: 'object', required: ['code', 'counts'], additionalProperties: false, properties: { code: { type: 'string' }, counts: spotCountsSchema } },
    },
    occupiedOrAssignedCount: count,
    counterGap: {
      type: 'object',
      required: ['kind', 'spots'],
      additionalProperties: false,
      properties: { kind: { type: 'string', enum: ['SPOTS_TO_CHECK', 'COUNTER_BELOW'] }, spots: count },
    },
    silentGateNames: { type: 'array', items: { type: 'string' } },
  },
} as const;

export type LotOccupancySchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardLotOccupancySchema>, WithMutableArrays<DashboardLotOccupancy>>>;
