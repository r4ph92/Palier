import type { LotSummary } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

const spotCountByCategorySchema = {
  type: 'object',
  required: ['standard', 'electric', 'accessible', 'oversize'],
  additionalProperties: false,
  properties: {
    standard: { type: 'integer' },
    electric: { type: 'integer' },
    accessible: { type: 'integer' },
    oversize: { type: 'integer' },
  },
} as const;

const locationSchema = {
  type: ['object', 'null'],
  required: ['latitude', 'longitude'],
  additionalProperties: false,
  properties: {
    latitude: { type: 'number' },
    longitude: { type: 'number' },
  },
} as const;

const tariffSchema = {
  type: ['object', 'null'],
  required: ['incrementCents', 'incrementMinutes', 'dailyCapCents'],
  additionalProperties: false,
  properties: {
    incrementCents: { type: 'integer' },
    incrementMinutes: { type: 'integer' },
    dailyCapCents: { type: 'integer' },
  },
} as const;

export const lotListResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'name', 'freeSpots', 'capacity', 'freeSpotsByCategory', 'location', 'tariff'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      freeSpots: { type: 'integer' },
      capacity: { type: 'integer', minimum: 0 },
      freeSpotsByCategory: spotCountByCategorySchema,
      location: locationSchema,
      tariff: tariffSchema,
    },
  },
} as const;

type SchemaLot = FromSchema<typeof lotListResponseSchema>[number];

export type ResponseSchemaMatchesLotSummary = AssertTrue<MutuallyAssignable<SchemaLot, LotSummary>>;
