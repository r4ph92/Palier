import type { ReceiptDetailResponse, ReceiptListResponse } from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable, WithMutableArrays } from './schemaMatchesType.ts';

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

export type ResponseSchemaMatchesReceiptList = AssertTrue<
  MutuallyAssignable<FromSchema<typeof receiptListResponseSchema>, WithMutableArrays<ReceiptListResponse>>
>;
export type ResponseSchemaMatchesReceiptDetail = AssertTrue<MutuallyAssignable<FromSchema<typeof receiptDetailResponseSchema>, ReceiptDetailResponse>>;
