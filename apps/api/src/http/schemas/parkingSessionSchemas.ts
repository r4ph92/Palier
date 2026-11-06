import type {
  BackdateParkingSessionRequest,
  CurrentParkingSessionResponse,
  ParkedPresumptionRequest,
  ParkedPresumptionResponse,
  TestClockReading,
} from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import type { FromSchema } from 'json-schema-to-ts';
import { assignedSpotSchema } from './entrySchemas.ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

const aisleRectangleSchema = {
  type: 'object',
  required: ['x', 'y', 'width', 'height'],
  additionalProperties: false,
  properties: { x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } },
} as const;

const planAisleSchema = {
  type: 'object',
  required: ['code', 'beaconMinor', 'rectangle'],
  additionalProperties: false,
  properties: {
    code: { type: 'string' },
    beaconMinor: { type: 'integer' },
    rectangle: { anyOf: [aisleRectangleSchema, { type: 'null' }] },
  },
} as const;

const levelPlanSchema = {
  type: 'object',
  required: ['levelCode', 'aisles'],
  additionalProperties: false,
  properties: { levelCode: { type: 'string' }, aisles: { type: 'array', items: planAisleSchema } },
} as const;

const currentParkingSessionSchema = {
  type: 'object',
  required: ['sessionId', 'state', 'lotName', 'spot', 'enteredAt', 'elapsedMinutes', 'amountCents', 'dailyCapCents', 'beaconMajor', 'levelPlan'],
  additionalProperties: false,
  properties: {
    sessionId: { type: 'string' },
    state: { type: 'string', enum: ACTIVE_ENTRY_SESSION_STATES },
    lotName: { type: 'string' },
    spot: assignedSpotSchema,
    enteredAt: { type: 'string' },
    elapsedMinutes: { type: 'integer' },
    amountCents: { type: 'integer' },
    dailyCapCents: { type: 'integer' },
    beaconMajor: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    levelPlan: { anyOf: [levelPlanSchema, { type: 'null' }] },
  },
} as const;

export const currentParkingSessionResponseSchema = {
  type: 'object',
  required: ['session'],
  additionalProperties: false,
  properties: { session: { anyOf: [currentParkingSessionSchema, { type: 'null' }] } },
} as const;

export const testClockReadingSchema = {
  type: 'object',
  required: ['now'],
  additionalProperties: false,
  properties: { now: { type: 'string', format: 'date-time' } },
} as const;

export const backdateParkingSessionSchema = {
  type: 'object',
  required: ['enteredAt'],
  additionalProperties: false,
  properties: { enteredAt: { type: 'string', format: 'date-time' } },
} as const;

// An ISO instant is under 30 characters; the cap keeps oversized text away from the date parser.
const INSTANT_MAX_LENGTH = 40;

export const parkedPresumptionRequestSchema = {
  type: 'object',
  required: ['detectedAt'],
  additionalProperties: false,
  properties: { detectedAt: { type: 'string', format: 'date-time', maxLength: INSTANT_MAX_LENGTH } },
} as const;

export const parkedPresumptionResponseSchema = {
  type: 'object',
  required: ['state', 'parkedAt'],
  additionalProperties: false,
  properties: { state: { type: 'string', const: 'PARKED_PRESUMED' }, parkedAt: { type: 'string' } },
} as const;

export type ResponseSchemaMatchesCurrentParkingSession = AssertTrue<
  MutuallyAssignable<FromSchema<typeof currentParkingSessionResponseSchema>, CurrentParkingSessionResponse>
>;
export type SchemaMatchesTestClockReading = AssertTrue<MutuallyAssignable<FromSchema<typeof testClockReadingSchema>, TestClockReading>>;
export type SchemaMatchesBackdateRequest = AssertTrue<
  MutuallyAssignable<FromSchema<typeof backdateParkingSessionSchema>, BackdateParkingSessionRequest>
>;
export type RequestSchemaMatchesParkedPresumption = AssertTrue<
  MutuallyAssignable<FromSchema<typeof parkedPresumptionRequestSchema>, ParkedPresumptionRequest>
>;
export type ResponseSchemaMatchesParkedPresumption = AssertTrue<
  MutuallyAssignable<FromSchema<typeof parkedPresumptionResponseSchema>, ParkedPresumptionResponse>
>;
