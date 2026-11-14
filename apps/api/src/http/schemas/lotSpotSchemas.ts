import type { DashboardAisleSpots } from '@palier/shared-types';
import type { AddSpotsRequest, SpotAttributes } from '@palier/shared-types/spotDraft';
import type { FromSchema } from 'json-schema-to-ts';
import { SPOT_STATES } from '../../domain/spots/spotStates.ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';
import { uuidSchema } from './uuidSchema.ts';

export const lotAisleParametersSchema = {
  type: 'object',
  required: ['id', 'aisleId'],
  properties: { id: uuidSchema, aisleId: uuidSchema },
} as const;

export const lotSpotParametersSchema = {
  type: 'object',
  required: ['id', 'spotId'],
  properties: { id: uuidSchema, spotId: uuidSchema },
} as const;

const boundedText = { type: 'string', maxLength: 1000 } as const;

// Shape only: the range and the distance follow the shared rule, so the dashboard and the API refuse the same values with the same code.
// A number, not an integer, for the distance: 1.5 gets the rule's SPOT_DISTANCE_INVALID like 2001 does.
export const spotAttributesBodySchema = {
  type: 'object',
  required: ['isEv', 'isAccessible', 'isOversize', 'distanceToExit'],
  additionalProperties: false,
  properties: { isEv: { type: 'boolean' }, isAccessible: { type: 'boolean' }, isOversize: { type: 'boolean' }, distanceToExit: { type: 'number' } },
} as const;

export const addSpotsBodySchema = {
  type: 'object',
  required: ['range', 'attributes'],
  additionalProperties: false,
  properties: {
    range: {
      type: 'object',
      required: ['prefix', 'first', 'last'],
      additionalProperties: false,
      properties: { prefix: boundedText, first: boundedText, last: boundedText },
    },
    attributes: spotAttributesBodySchema,
  },
} as const;

const dashboardSpotSchema = {
  type: 'object',
  required: ['id', 'number', 'state', 'isEv', 'isAccessible', 'isOversize', 'distanceToExit'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    number: { type: 'string' },
    state: { type: 'string', enum: SPOT_STATES },
    isEv: { type: 'boolean' },
    isAccessible: { type: 'boolean' },
    isOversize: { type: 'boolean' },
    distanceToExit: { type: 'integer' },
  },
} as const;

export const dashboardAisleSpotsSchema = {
  type: 'object',
  required: ['aisleId', 'spots', 'spotCount', 'capacity'],
  additionalProperties: false,
  properties: { aisleId: { type: 'string' }, spots: { type: 'array', items: dashboardSpotSchema }, spotCount: { type: 'integer' }, capacity: { type: 'integer' } },
} as const;

export type SpotAttributesSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof spotAttributesBodySchema>, SpotAttributes>>;
export type AddSpotsSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof addSpotsBodySchema>, AddSpotsRequest>>;
export type AisleSpotsSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardAisleSpotsSchema>, WithMutableArrays<DashboardAisleSpots>>>;
