import type { DashboardLotEquipment } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';

const gateHealthSchema = {
  type: 'object',
  required: ['id', 'name', 'kind', 'health', 'lastHeartbeatAt'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    kind: { type: 'string', enum: ['ENTRY', 'EXIT'] },
    health: { type: 'string', enum: ['ONLINE', 'SILENT', 'NEVER_HEARD'] },
    lastHeartbeatAt: { type: ['string', 'null'] },
  },
} as const;

export const dashboardLotEquipmentSchema = {
  type: 'object',
  required: ['lotId', 'lotName', 'now', 'gates'],
  additionalProperties: false,
  properties: {
    lotId: { type: 'string' },
    lotName: { type: 'string' },
    now: { type: 'string' },
    gates: { type: 'array', items: gateHealthSchema },
  },
} as const;

export type LotEquipmentSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardLotEquipmentSchema>, WithMutableArrays<DashboardLotEquipment>>>;
