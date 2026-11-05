import type { CurrentSpotHoldResponse, SpotHold } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';
import { uuidSchema } from './uuidSchema.ts';

// additionalProperties false: the response schema strips any field it does not list, the spot number included.
export const spotHoldSchema = {
  type: 'object',
  required: ['spotHoldId', 'lotId', 'lotName', 'expiresAt', 'now'],
  additionalProperties: false,
  properties: {
    spotHoldId: { type: 'string' },
    lotId: { type: 'string' },
    lotName: { type: 'string' },
    expiresAt: { type: 'string' },
    now: { type: 'string' },
  },
} as const;

export const currentSpotHoldResponseSchema = {
  type: 'object',
  required: ['spotHold'],
  additionalProperties: false,
  properties: { spotHold: { anyOf: [spotHoldSchema, { type: 'null' }] } },
} as const;

// The lot id of a request, the hold id of a release.
export const spotHoldPathParametersSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: uuidSchema },
} as const;

export type SpotHoldPathParameters = FromSchema<typeof spotHoldPathParametersSchema>;

export type ResponseSchemaMatchesSpotHold = AssertTrue<MutuallyAssignable<FromSchema<typeof spotHoldSchema>, SpotHold>>;
export type ResponseSchemaMatchesCurrentSpotHold = AssertTrue<
  MutuallyAssignable<FromSchema<typeof currentSpotHoldResponseSchema>, CurrentSpotHoldResponse>
>;
