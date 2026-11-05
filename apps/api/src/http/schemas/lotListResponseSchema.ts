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

export const lotListResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'name', 'freeSpots', 'freeSpotsByCategory', 'location'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      freeSpots: { type: 'integer' },
      freeSpotsByCategory: spotCountByCategorySchema,
      location: locationSchema,
    },
  },
} as const;

type SchemaLot = FromSchema<typeof lotListResponseSchema>[number];

export type ResponseSchemaMatchesLotSummary = AssertTrue<MutuallyAssignable<SchemaLot, LotSummary>>;
