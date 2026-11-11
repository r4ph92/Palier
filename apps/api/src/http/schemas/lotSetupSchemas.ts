import type { DashboardLotDetails } from '@palier/shared-types';
import type { LotDraft } from '@palier/shared-types/lotDraft';
import type { LotPricingRequest } from '@palier/shared-types/lotPricing';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

// Shape only: every range lives in the shared rules, so the dashboard and the API refuse the same values with the same code.
export const lotDraftBodySchema = {
  type: 'object',
  required: ['name', 'address', 'latitude', 'longitude', 'capacity'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', maxLength: 1000 },
    address: { type: 'string', maxLength: 1000 },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    capacity: { type: 'integer' },
  },
} as const;

export const lotPricingBodySchema = {
  type: 'object',
  required: ['incrementCents', 'incrementMinutes', 'dailyCapCents', 'holdQuota'],
  additionalProperties: false,
  properties: {
    incrementCents: { type: 'integer' },
    incrementMinutes: { type: 'integer' },
    dailyCapCents: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    holdQuota: { type: 'integer' },
  },
} as const;

// A saved pricing always has its cap: the request's nullable cap, made required.
const lotPricingSchema = {
  ...lotPricingBodySchema,
  properties: { ...lotPricingBodySchema.properties, dailyCapCents: { type: 'integer' } },
} as const;

const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] } as const;

// anyOf with null, so fast-json-stringify writes null and never 0 for a missing value.
export const dashboardLotDetailsSchema = {
  type: 'object',
  required: ['id', 'name', 'isOnline', 'address', 'latitude', 'longitude', 'capacity', 'beaconMajor', 'pricing'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    isOnline: { type: 'boolean' },
    address: { type: 'string' },
    latitude: nullableNumber,
    longitude: nullableNumber,
    capacity: { type: 'integer' },
    beaconMajor: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    pricing: { anyOf: [lotPricingSchema, { type: 'null' }] },
  },
} as const;

export type LotDraftSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof lotDraftBodySchema>, LotDraft>>;
export type LotPricingSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof lotPricingBodySchema>, LotPricingRequest>>;
export type LotDetailsSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardLotDetailsSchema>, DashboardLotDetails>>;
