import type { DashboardStaleSessions } from '@palier/shared-types';
import { LAST_PROOF_KINDS } from '@palier/shared-types/staleSessions';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';
import { uuidSchema } from './uuidSchema.ts';

export const staleSessionParametersSchema = {
  type: 'object',
  required: ['id', 'sessionId'],
  properties: { id: uuidSchema, sessionId: uuidSchema },
} as const;

const spotSchema = {
  type: 'object',
  required: ['number', 'levelCode', 'aisleCode'],
  additionalProperties: false,
  properties: { number: { type: 'string' }, levelCode: { type: 'string' }, aisleCode: { type: 'string' } },
} as const;

const staleSessionSchema = {
  type: 'object',
  required: ['id', 'plate', 'spot', 'lastProofAt', 'lastProofKind', 'flaggedAt'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    plate: { type: 'string' },
    spot: spotSchema,
    lastProofAt: { type: 'string' },
    lastProofKind: { type: 'string', enum: LAST_PROOF_KINDS },
    flaggedAt: { type: 'string' },
  },
} as const;

export const staleSessionsSchema = {
  type: 'object',
  required: ['lotName', 'sessions'],
  additionalProperties: false,
  properties: { lotName: { type: 'string' }, sessions: { type: 'array', items: staleSessionSchema } },
} as const;

export type StaleSessionsSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof staleSessionsSchema>, WithMutableArrays<DashboardStaleSessions>>>;
