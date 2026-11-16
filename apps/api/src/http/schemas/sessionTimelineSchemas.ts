import type { DashboardSessionDetail, DashboardSessionList } from '@palier/shared-types';
import { ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import {
  CANCELLATION_REASONS,
  GATE_DIRECTIONS,
  PARKING_EVIDENCES,
  SESSION_EXIT_METHODS,
  SESSION_LIST_STATUSES,
  TIMELINE_KINDS,
} from '@palier/shared-types/sessionTimeline';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';
import { uuidSchema } from './uuidSchema.ts';

export const sessionParametersSchema = {
  type: 'object',
  required: ['id', 'sessionId'],
  properties: { id: uuidSchema, sessionId: uuidSchema },
} as const;

export const sessionListQuerySchema = {
  type: 'object',
  properties: { status: { type: 'string', enum: SESSION_LIST_STATUSES }, before: uuidSchema },
} as const;

const instant = { type: 'string' } as const;
const nullableInstant = { type: ['string', 'null'] } as const;
const nullableCents = { type: ['integer', 'null'] } as const;

const sessionRowSchema = {
  type: 'object',
  required: ['id', 'plate', 'state', 'entryAt', 'exitAt', 'assignedSpotNumber', 'amountCents'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    plate: { type: 'string' },
    state: { type: 'string', enum: ENTRY_SESSION_STATES },
    entryAt: instant,
    exitAt: nullableInstant,
    assignedSpotNumber: { type: 'string' },
    amountCents: nullableCents,
  },
} as const;

export const sessionListSchema = {
  type: 'object',
  required: ['lotName', 'sessions', 'nextCursor'],
  additionalProperties: false,
  properties: { lotName: { type: 'string' }, sessions: { type: 'array', items: sessionRowSchema }, nextCursor: { type: ['string', 'null'] } },
} as const;

const summarySchema = {
  type: 'object',
  required: ['plate', 'state', 'assignedSpotNumber', 'realSpotNumber', 'parkingEvidence', 'exitMethod', 'amountCents', 'unpaidCents', 'entryAt', 'exitAt'],
  additionalProperties: false,
  properties: {
    plate: { type: 'string' },
    state: { type: 'string', enum: ENTRY_SESSION_STATES },
    assignedSpotNumber: { type: 'string' },
    realSpotNumber: { type: ['string', 'null'] },
    parkingEvidence: { type: ['string', 'null'], enum: [...PARKING_EVIDENCES, null] },
    exitMethod: { type: ['string', 'null'], enum: [...SESSION_EXIT_METHODS, null] },
    amountCents: nullableCents,
    unpaidCents: { type: 'integer' },
    entryAt: instant,
    exitAt: nullableInstant,
  },
} as const;

// One flat list of whitelisted facts: a field not named here is dropped from the answer, whatever the domain hands over.
const timelineDetailsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    direction: { type: 'string', enum: GATE_DIRECTIONS },
    spotNumber: { type: 'string' },
    aisleCode: { type: 'string' },
    isAssignedAisle: { type: 'boolean' },
    evidence: { type: 'string', enum: ['ON_FOOT', 'TIMEOUT'] },
    method: { type: 'string', enum: SESSION_EXIT_METHODS },
    reason: { type: 'string', enum: CANCELLATION_REASONS },
    amountCents: { type: 'integer' },
    unpaidCents: { type: 'integer' },
  },
} as const;

const timelineEntrySchema = {
  type: 'object',
  required: ['step', 'kind', 'occurredAt', 'details'],
  additionalProperties: false,
  properties: { step: { type: 'integer', minimum: 1 }, kind: { type: 'string', enum: TIMELINE_KINDS }, occurredAt: instant, details: timelineDetailsSchema },
} as const;

export const sessionDetailSchema = {
  type: 'object',
  required: ['lotName', 'summary', 'timeline'],
  additionalProperties: false,
  properties: { lotName: { type: 'string' }, summary: summarySchema, timeline: { type: 'array', items: timelineEntrySchema } },
} as const;

export type SessionListSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof sessionListSchema>, WithMutableArrays<DashboardSessionList>>>;
export type SessionDetailSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof sessionDetailSchema>, WithMutableArrays<DashboardSessionDetail>>>;
