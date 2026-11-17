import type { LotExitShares } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

const count = { type: 'integer' } as const;

export const lotExitSharesSchema = {
  type: 'object',
  required: ['lotName', 'totalExits', 'counts'],
  additionalProperties: false,
  properties: {
    lotName: { type: 'string' },
    totalExits: count,
    counts: {
      type: 'object',
      required: ['BEACON', 'APP', 'PLATE', 'TRANSPONDER', 'STAFF'],
      additionalProperties: false,
      properties: { BEACON: count, APP: count, PLATE: count, TRANSPONDER: count, STAFF: count },
    },
  },
} as const;

export type LotExitSharesSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof lotExitSharesSchema>, LotExitShares>>;
