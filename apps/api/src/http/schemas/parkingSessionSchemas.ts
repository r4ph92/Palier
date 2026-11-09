import type {
  BackdateParkingSessionRequest,
  CurrentParkingSessionResponse,
  ExitResponse,
  ParkedPresumptionRequest,
  ParkedPresumptionResponse,
  ParkedSpotAnswerRequest,
  ParkedSpotAnswerResponse,
  ReceiptDetailResponse,
  ReceiptListResponse,
  SpotTakenRequest,
  SpotTakenResponse,
  TestClockReading,
} from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES, WALKED_AWAY_STATES } from '@palier/shared-types/entries';
import { SPOT_NUMBER_MAX_LENGTH } from '@palier/shared-types/spotNumber';
import type { FromSchema } from 'json-schema-to-ts';
import { assignedSpotSchema } from './entrySchemas.ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';

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

const parkedQuestionSchema = {
  type: 'object',
  required: ['aisleCode', 'freeSpotNumbers'],
  additionalProperties: false,
  properties: { aisleCode: { type: 'string' }, freeSpotNumbers: { type: 'array', items: { type: 'string' } } },
} as const;

const currentParkingSessionSchema = {
  type: 'object',
  required: ['sessionId', 'state', 'lotName', 'spot', 'enteredAt', 'elapsedMinutes', 'amountCents', 'dailyCapCents', 'beaconMajor', 'levelPlan', 'question'],
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
    question: { anyOf: [parkedQuestionSchema, { type: 'null' }] },
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

// An iBeacon minor is an unsigned 16-bit number.
const BEACON_MINOR_MAXIMUM = 65_535;

export const parkedPresumptionRequestSchema = {
  type: 'object',
  required: ['detectedAt'],
  additionalProperties: false,
  properties: {
    detectedAt: { type: 'string', format: 'date-time', maxLength: INSTANT_MAX_LENGTH },
    detectedAisleMinor: { type: 'integer', minimum: 0, maximum: BEACON_MINOR_MAXIMUM },
  },
} as const;

export const parkedPresumptionResponseSchema = {
  type: 'object',
  required: ['state', 'parkedAt'],
  additionalProperties: false,
  properties: {
    state: { type: 'string', enum: WALKED_AWAY_STATES },
    parkedAt: { type: 'string' },
  },
} as const;

// Spot numbers are a few characters (« B-3 »); the cap keeps oversized text away from the normalizer.
// Postgres text cannot hold U+0000, and no painted number has a control character.
const WITHOUT_CONTROL_CHARACTERS = '^[^\\u0000-\\u001F\\u007F]*$';

export const parkedSpotAnswerRequestSchema = {
  type: 'object',
  required: ['spotNumber'],
  additionalProperties: false,
  properties: { spotNumber: { type: 'string', minLength: 1, maxLength: SPOT_NUMBER_MAX_LENGTH, pattern: WITHOUT_CONTROL_CHARACTERS } },
} as const;

export const parkedSpotAnswerResponseSchema = {
  type: 'object',
  required: ['state', 'spot'],
  additionalProperties: false,
  properties: { state: { type: 'string', const: 'PARKED_CONFIRMED' }, spot: assignedSpotSchema },
} as const;

// The app sends the number it showed, exactly; the same limits as an answer keep the comparison on a few characters.
export const spotTakenRequestSchema = parkedSpotAnswerRequestSchema;

export const spotTakenResponseSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['outcome', 'spot'],
      additionalProperties: false,
      properties: { outcome: { type: 'string', const: 'reassigned' }, spot: assignedSpotSchema },
    },
    {
      type: 'object',
      required: ['outcome'],
      additionalProperties: false,
      properties: { outcome: { type: 'string', const: 'none-free' } },
    },
  ],
} as const;

export const exitResponseSchema = {
  type: 'object',
  required: ['receipt'],
  additionalProperties: false,
  properties: {
    receipt: {
      type: 'object',
      required: ['exitedAt', 'durationMinutes', 'increments', 'incrementCents', 'totalCents', 'capped'],
      additionalProperties: false,
      properties: {
        exitedAt: { type: 'string' },
        durationMinutes: { type: 'integer' },
        increments: { type: 'integer' },
        incrementCents: { type: 'integer' },
        totalCents: { type: 'integer' },
        capped: { type: 'boolean' },
      },
    },
  },
} as const;

const exitReceiptProperties = {
  exitedAt: { type: 'string' },
  durationMinutes: { type: 'integer' },
  increments: { type: 'integer' },
  incrementCents: { type: 'integer' },
  totalCents: { type: 'integer' },
  capped: { type: 'boolean' },
} as const;

export const receiptListResponseSchema = {
  type: 'object',
  required: ['receipts'],
  additionalProperties: false,
  properties: {
    receipts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['sessionId', 'lotName', 'exitedAt', 'durationMinutes', 'totalCents'],
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string' },
          lotName: { type: 'string' },
          exitedAt: exitReceiptProperties.exitedAt,
          durationMinutes: exitReceiptProperties.durationMinutes,
          totalCents: exitReceiptProperties.totalCents,
        },
      },
    },
  },
} as const;

export const receiptDetailResponseSchema = {
  type: 'object',
  required: ['receipt'],
  additionalProperties: false,
  properties: {
    receipt: {
      type: 'object',
      required: ['sessionId', 'lotName', 'enteredAt', 'cardLast4', 'exitedAt', 'durationMinutes', 'increments', 'incrementCents', 'totalCents', 'capped'],
      additionalProperties: false,
      properties: {
        sessionId: { type: 'string' },
        lotName: { type: 'string' },
        enteredAt: { type: 'string' },
        cardLast4: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        ...exitReceiptProperties,
      },
    },
  },
} as const;

export type ResponseSchemaMatchesCurrentParkingSession = AssertTrue<
  MutuallyAssignable<FromSchema<typeof currentParkingSessionResponseSchema>, WithMutableArrays<CurrentParkingSessionResponse>>
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
export type RequestSchemaMatchesParkedSpotAnswer = AssertTrue<
  MutuallyAssignable<FromSchema<typeof parkedSpotAnswerRequestSchema>, ParkedSpotAnswerRequest>
>;
export type ResponseSchemaMatchesParkedSpotAnswer = AssertTrue<
  MutuallyAssignable<FromSchema<typeof parkedSpotAnswerResponseSchema>, ParkedSpotAnswerResponse>
>;
export type RequestSchemaMatchesSpotTaken = AssertTrue<MutuallyAssignable<FromSchema<typeof spotTakenRequestSchema>, SpotTakenRequest>>;
export type ResponseSchemaMatchesSpotTaken = AssertTrue<MutuallyAssignable<FromSchema<typeof spotTakenResponseSchema>, SpotTakenResponse>>;
export type ResponseSchemaMatchesExit = AssertTrue<MutuallyAssignable<FromSchema<typeof exitResponseSchema>, ExitResponse>>;
export type ResponseSchemaMatchesReceiptList = AssertTrue<
  MutuallyAssignable<FromSchema<typeof receiptListResponseSchema>, WithMutableArrays<ReceiptListResponse>>
>;
export type ResponseSchemaMatchesReceiptDetail = AssertTrue<MutuallyAssignable<FromSchema<typeof receiptDetailResponseSchema>, ReceiptDetailResponse>>;
