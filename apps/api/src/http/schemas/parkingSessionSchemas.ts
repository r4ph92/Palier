import type { BackdateParkingSessionRequest, CurrentParkingSessionResponse, TestClockReading } from '@palier/shared-types';
import { ACTIVE_ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import type { FromSchema } from 'json-schema-to-ts';
import { assignedSpotSchema } from './entrySchemas.ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

const currentParkingSessionSchema = {
  type: 'object',
  required: ['sessionId', 'state', 'lotName', 'spot', 'enteredAt', 'elapsedMinutes', 'amountCents', 'dailyCapCents'],
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

export type ResponseSchemaMatchesCurrentParkingSession = AssertTrue<
  MutuallyAssignable<FromSchema<typeof currentParkingSessionResponseSchema>, CurrentParkingSessionResponse>
>;
export type SchemaMatchesTestClockReading = AssertTrue<MutuallyAssignable<FromSchema<typeof testClockReadingSchema>, TestClockReading>>;
export type SchemaMatchesBackdateRequest = AssertTrue<
  MutuallyAssignable<FromSchema<typeof backdateParkingSessionSchema>, BackdateParkingSessionRequest>
>;
