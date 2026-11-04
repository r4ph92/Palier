import type { EntryRequest, EntryResponse, EntryStatusResponse, GateCommand } from '@palier/shared-types';
import { ENTRY_SESSION_STATES } from '@palier/shared-types/entries';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

// A printed QR link is under 120 characters; the cap only keeps oversized bodies away from the token parser.
const QR_CONTENT_MAX_LENGTH = 512;

export const entryRequestSchema = {
  type: 'object',
  required: ['qrContent'],
  additionalProperties: false,
  properties: { qrContent: { type: 'string', maxLength: QR_CONTENT_MAX_LENGTH } },
} as const;

const assignedSpotSchema = {
  type: 'object',
  required: ['number', 'levelCode', 'aisleCode'],
  additionalProperties: false,
  properties: { number: { type: 'string' }, levelCode: { type: 'string' }, aisleCode: { type: 'string' } },
} as const;

export const entryResponseSchema = {
  type: 'object',
  required: ['sessionId', 'spot', 'barrierOpened'],
  additionalProperties: false,
  properties: {
    sessionId: { type: 'string' },
    spot: assignedSpotSchema,
    barrierOpened: { type: 'boolean', const: true },
  },
} as const;

export const entryStatusResponseSchema = {
  type: 'object',
  required: ['sessionId', 'state', 'spot', 'entryConfirmedAt'],
  additionalProperties: false,
  properties: {
    sessionId: { type: 'string' },
    state: { type: 'string', enum: ENTRY_SESSION_STATES },
    spot: assignedSpotSchema,
    entryConfirmedAt: { type: ['string', 'null'] },
  },
} as const;

export const entrySessionParametersSchema = {
  type: 'object',
  required: ['sessionId'],
  properties: { sessionId: { type: 'string', format: 'uuid' } },
} as const;

export type EntrySessionParameters = FromSchema<typeof entrySessionParametersSchema>;

const gateCommandSchema = {
  type: 'object',
  required: ['id', 'kind', 'issuedAt'],
  additionalProperties: false,
  properties: { id: { type: 'string' }, kind: { type: 'string', enum: ['OPEN'] }, issuedAt: { type: 'string' } },
} as const;

export const gateCommandListSchema = { type: 'array', items: gateCommandSchema } as const;

export const gateCommandsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: { after: { type: 'string', format: 'date-time' }, afterId: { type: 'string', format: 'uuid' } },
} as const;

export type GateCommandsQuery = FromSchema<typeof gateCommandsQuerySchema>;

export type RequestSchemaMatchesEntryRequest = AssertTrue<MutuallyAssignable<FromSchema<typeof entryRequestSchema>, EntryRequest>>;
export type ResponseSchemaMatchesEntryResponse = AssertTrue<MutuallyAssignable<FromSchema<typeof entryResponseSchema>, EntryResponse>>;
export type CommandSchemaMatchesGateCommand = AssertTrue<MutuallyAssignable<FromSchema<typeof gateCommandSchema>, GateCommand>>;
export type ResponseSchemaMatchesEntryStatus = AssertTrue<
  MutuallyAssignable<FromSchema<typeof entryStatusResponseSchema>, EntryStatusResponse>
>;
