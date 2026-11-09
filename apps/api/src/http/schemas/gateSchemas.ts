import type { GateIdentity, GatePassageRequest, GatePassageResponse } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';
import { idPathParametersSchema } from './uuidSchema.ts';

const gateKindSchema = { type: 'string', enum: ['ENTRY', 'EXIT'] } as const;

export const gateIdentitySchema = {
  type: 'object',
  required: ['id', 'name', 'kind', 'lotName'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    kind: gateKindSchema,
    lotName: { type: 'string' },
  },
} as const;

export const gateIdParametersSchema = idPathParametersSchema;

export const passageRequestSchema = {
  type: 'object',
  required: ['closedAt'],
  additionalProperties: false,
  properties: { closedAt: { type: 'string', format: 'date-time' } },
} as const;

export const passageResponseSchema = {
  type: 'object',
  required: ['gateId', 'lotId', 'kind', 'closedAt', 'vehicleCount', 'confirmedSessionId', 'exitedSessionId'],
  additionalProperties: false,
  properties: {
    gateId: { type: 'string' },
    lotId: { type: 'string' },
    kind: gateKindSchema,
    closedAt: { type: 'string' },
    vehicleCount: { type: 'integer' },
    confirmedSessionId: { type: ['string', 'null'] },
    exitedSessionId: { type: ['string', 'null'] },
  },
} as const;

export type GateIdParameters = FromSchema<typeof gateIdParametersSchema>;

export type IdentitySchemaMatchesGateIdentity = AssertTrue<MutuallyAssignable<FromSchema<typeof gateIdentitySchema>, GateIdentity>>;
export type RequestSchemaMatchesPassageRequest = AssertTrue<
  MutuallyAssignable<FromSchema<typeof passageRequestSchema>, GatePassageRequest>
>;
export type ResponseSchemaMatchesPassageResponse = AssertTrue<
  MutuallyAssignable<FromSchema<typeof passageResponseSchema>, GatePassageResponse>
>;
