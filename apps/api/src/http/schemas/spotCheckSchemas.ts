import type { DashboardSpotsToCheck } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import { SPOT_CHECK_REASONS } from '@palier/shared-types/dashboard';
import { SPOT_STATES } from '../../domain/spots/spotStates.ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';

const spotToCheckSchema = {
  type: 'object',
  required: ['spotId', 'number', 'levelCode', 'aisleCode', 'since', 'reason', 'state', 'clearable'],
  additionalProperties: false,
  properties: {
    spotId: { type: 'string' },
    number: { type: 'string' },
    levelCode: { type: 'string' },
    aisleCode: { type: 'string' },
    since: { type: 'string' },
    reason: { type: ['string', 'null'], enum: [...SPOT_CHECK_REASONS, null] },
    state: { type: 'string', enum: SPOT_STATES },
    clearable: { type: 'boolean' },
  },
} as const;

export const spotsToCheckSchema = {
  type: 'object',
  required: ['lotName', 'spots'],
  additionalProperties: false,
  properties: { lotName: { type: 'string' }, spots: { type: 'array', items: spotToCheckSchema } },
} as const;

export type SpotsToCheckSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof spotsToCheckSchema>, WithMutableArrays<DashboardSpotsToCheck>>>;
