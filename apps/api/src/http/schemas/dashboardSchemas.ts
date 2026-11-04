import type {
  CreateOperatorRequest,
  DashboardLot,
  DashboardMeResponse,
  DashboardOperator,
  DashboardSignInResponse,
  DashboardTestSignInRequest,
  DashboardUser,
} from '@palier/shared-types';
import type { FromSchema } from 'json-schema-to-ts';
import type { AssertTrue, MutuallyAssignable } from './schemaMatchesType.ts';

export const dashboardUserSchema = {
  type: 'object',
  required: ['id', 'firstName', 'lastName'],
  additionalProperties: false,
  properties: { id: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' } },
} as const;

export const dashboardOperatorSchema = {
  type: 'object',
  required: ['id', 'legalName', 'kycStatus'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    legalName: { type: 'string' },
    kycStatus: { type: 'string', enum: ['NOT_STARTED', 'PENDING', 'ACTION_REQUIRED', 'VERIFIED'] },
  },
} as const;

export const dashboardMeSchema = {
  type: 'object',
  required: ['user', 'operator'],
  additionalProperties: false,
  properties: { user: dashboardUserSchema, operator: { anyOf: [dashboardOperatorSchema, { type: 'null' }] } },
} as const;

export const dashboardLotSchema = {
  type: 'object',
  required: ['id', 'name', 'isOnline'],
  additionalProperties: false,
  properties: { id: { type: 'string' }, name: { type: 'string' }, isOnline: { type: 'boolean' } },
} as const;

export const dashboardLotListSchema = { type: 'array', items: dashboardLotSchema } as const;

export const dashboardTestUserListSchema = { type: 'array', items: dashboardUserSchema } as const;

export const dashboardSignInResponseSchema = {
  type: 'object',
  required: ['user'],
  additionalProperties: false,
  properties: { user: dashboardUserSchema },
} as const;

export const dashboardTestSignInBodySchema = {
  type: 'object',
  required: ['userId'],
  additionalProperties: false,
  properties: { userId: { type: 'string', format: 'uuid' } },
} as const;

// The length rule applies to the trimmed name in the domain; this bound only keeps huge bodies out.
export const createOperatorBodySchema = {
  type: 'object',
  required: ['legalName'],
  additionalProperties: false,
  properties: { legalName: { type: 'string', maxLength: 1000 } },
} as const;

export const lotIdParametersSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

export type UserSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardUserSchema>, DashboardUser>>;
export type OperatorSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardOperatorSchema>, DashboardOperator>>;
export type MeSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardMeSchema>, DashboardMeResponse>>;
export type LotSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardLotSchema>, DashboardLot>>;
export type SignInSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof dashboardSignInResponseSchema>, DashboardSignInResponse>>;
export type SignInBodySchemaMatches = AssertTrue<
  MutuallyAssignable<FromSchema<typeof dashboardTestSignInBodySchema>, DashboardTestSignInRequest>
>;
export type CreateOperatorSchemaMatches = AssertTrue<MutuallyAssignable<FromSchema<typeof createOperatorBodySchema>, CreateOperatorRequest>>;
