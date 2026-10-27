import type { LotSummary } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';

export const lotListResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'name', 'freeSpots'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      freeSpots: { type: 'integer' },
    },
  },
} as const;

type SchemaLot = FromSchema<typeof lotListResponseSchema>[number];
type MutuallyAssignable<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type AssertTrue<Condition extends true> = Condition;

export type ResponseSchemaMatchesLotSummary = AssertTrue<MutuallyAssignable<SchemaLot, LotSummary>>;
