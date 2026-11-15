import type { Attestation, LotOnlineRequest, LotPublication } from '@palier/shared-types';
import { GATE_KINDS } from '@palier/shared-types/gates';
import { MISSING_PREREQUISITE_CODES } from '@palier/shared-types/publication';
import type { FromSchema } from 'json-schema-to-ts';
import { KYC_STATUSES } from './dashboardSchemas.ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';

const attestationProperties = { measuredOn: { type: 'string', maxLength: 64 }, note: { type: 'string', maxLength: 4096 } } as const;

// Shape only: the day and the note follow the shared rule, so the dashboard and the API refuse them with the same code.
export const attestationBodySchema = {
  type: 'object',
  required: ['measuredOn', 'note'],
  additionalProperties: false,
  properties: attestationProperties,
} as const;

export const lotOnlineBodySchema = {
  type: 'object',
  required: ['online'],
  additionalProperties: false,
  properties: { online: { type: 'boolean' } },
} as const;

const attestationSchema = { ...attestationBodySchema, properties: { measuredOn: { type: 'string' }, note: { type: 'string' } } } as const;

const publicationGateSchema = {
  type: 'object',
  required: ['id', 'name', 'kind', 'verifiedAt'],
  additionalProperties: false,
  properties: { id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string', enum: GATE_KINDS }, verifiedAt: { type: ['string', 'null'] } },
} as const;

const missingPrerequisiteSchema = {
  type: 'object',
  required: ['code', 'gateId'],
  additionalProperties: false,
  properties: { code: { type: 'string', enum: MISSING_PREREQUISITE_CODES }, gateId: { type: ['string', 'null'] } },
} as const;

export const lotPublicationSchema = {
  type: 'object',
  required: ['lotId', 'lotName', 'isOnline', 'stripe', 'pricing', 'spots', 'wifi', 'cellular', 'gates', 'missing'],
  additionalProperties: false,
  properties: {
    lotId: { type: 'string' },
    lotName: { type: 'string' },
    isOnline: { type: 'boolean' },
    stripe: { type: 'object', required: ['kycStatus'], additionalProperties: false, properties: { kycStatus: { type: 'string', enum: KYC_STATUSES } } },
    pricing: { type: 'object', required: ['dailyCapCents'], additionalProperties: false, properties: { dailyCapCents: { type: ['integer', 'null'] } } },
    spots: {
      type: 'object',
      required: ['inServiceCount', 'capacity'],
      additionalProperties: false,
      properties: { inServiceCount: { type: 'integer' }, capacity: { type: 'integer' } },
    },
    wifi: { anyOf: [attestationSchema, { type: 'null' }] },
    cellular: { anyOf: [attestationSchema, { type: 'null' }] },
    gates: { type: 'array', items: publicationGateSchema },
    missing: { type: 'array', items: missingPrerequisiteSchema },
  },
} as const;

export type AttestationSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof attestationBodySchema>, Attestation>>;
export type LotOnlineSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof lotOnlineBodySchema>, LotOnlineRequest>>;
export type LotPublicationSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof lotPublicationSchema>, WithMutableArrays<LotPublication>>>;
