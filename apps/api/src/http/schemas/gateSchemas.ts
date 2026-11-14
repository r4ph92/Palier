import type {
  GateIdentity,
  GateIdentifyRequest,
  GateIdentifyResponse,
  GatePassageRequest,
  GatePassageResponse,
  GatePresenceResponse,
  PassageReplayRequest,
  PassageReplayResponse,
} from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';
import { idPathParametersSchema, uuidSchema } from './uuidSchema.ts';

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

// Path parameters are strings: the minor is digits without a leading zero, read as a number by the route and bounded by the rule.
export const batteryReportParametersSchema = {
  type: 'object',
  required: ['id', 'minor'],
  properties: { id: uuidSchema, minor: { type: 'string', pattern: '^(0|[1-9][0-9]{0,4})$' } },
} as const;

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

export const MAXIMUM_REPLAY_BATCH = 500;

export const replayRequestSchema = {
  type: 'object',
  required: ['passages'],
  additionalProperties: false,
  properties: {
    passages: {
      type: 'array',
      minItems: 1,
      maxItems: MAXIMUM_REPLAY_BATCH,
      items: {
        type: 'object',
        required: ['id', 'kind', 'closedAt'],
        additionalProperties: false,
        properties: { id: uuidSchema, kind: gateKindSchema, closedAt: { type: 'string', format: 'date-time' } },
      },
    },
  },
} as const;

export const replayResponseSchema = {
  type: 'object',
  required: ['counted', 'duplicates', 'vehicleCount'],
  additionalProperties: false,
  properties: { counted: { type: 'integer' }, duplicates: { type: 'integer' }, vehicleCount: { type: 'integer' } },
} as const;

export const identifyRequestSchema = {
  type: 'object',
  required: ['identifier'],
  additionalProperties: false,
  properties: { identifier: { type: 'string', maxLength: 64 } },
} as const;

export const identifyResponseSchema = {
  type: 'object',
  required: ['outcome', 'identification'],
  additionalProperties: false,
  properties: {
    outcome: { type: 'string', enum: ['opened', 'fallback'] },
    identification: { type: ['string', 'null'], enum: ['plate', 'transponder', null] },
  },
} as const;

export const presenceResponseSchema = {
  type: 'object',
  required: ['outcome'],
  additionalProperties: false,
  properties: { outcome: { type: 'string', enum: ['waiting', 'opened', 'fallback'] } },
} as const;

export type GateIdParameters = FromSchema<typeof gateIdParametersSchema>;
export type BatteryReportParameters = FromSchema<typeof batteryReportParametersSchema>;

export type IdentitySchemaMatchesGateIdentity = AssertTrue<MutuallyAssignable<FromSchema<typeof gateIdentitySchema>, GateIdentity>>;
export type RequestSchemaMatchesPassageRequest = AssertTrue<
  MutuallyAssignable<FromSchema<typeof passageRequestSchema>, GatePassageRequest>
>;
export type ResponseSchemaMatchesPassageResponse = AssertTrue<
  MutuallyAssignable<FromSchema<typeof passageResponseSchema>, GatePassageResponse>
>;
export type RequestSchemaMatchesIdentifyRequest = AssertTrue<MutuallyAssignable<FromSchema<typeof identifyRequestSchema>, GateIdentifyRequest>>;
export type ResponseSchemaMatchesIdentifyResponse = AssertTrue<MutuallyAssignable<FromSchema<typeof identifyResponseSchema>, GateIdentifyResponse>>;
export type ResponseSchemaMatchesPresenceResponse = AssertTrue<MutuallyAssignable<FromSchema<typeof presenceResponseSchema>, GatePresenceResponse>>;
export type RequestSchemaMatchesReplayRequest = AssertTrue<MutuallyAssignable<FromSchema<typeof replayRequestSchema>, WithMutableArrays<PassageReplayRequest>>>;
export type ResponseSchemaMatchesReplayResponse = AssertTrue<MutuallyAssignable<FromSchema<typeof replayResponseSchema>, PassageReplayResponse>>;
