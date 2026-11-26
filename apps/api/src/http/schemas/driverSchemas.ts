import { uuidSchema } from './uuidSchema.ts';

const driverProfileProperties = {
  id: { type: 'string' },
  firstName: { type: 'string' },
} as const;

export const driverProfileSchema = {
  type: 'object',
  required: ['id', 'firstName'],
  additionalProperties: false,
  properties: driverProfileProperties,
} as const;

export const testDriverListSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'firstName', 'lastName'],
    additionalProperties: false,
    properties: { ...driverProfileProperties, lastName: { type: 'string' } },
  },
} as const;

export const testSignInBodySchema = {
  type: 'object',
  required: ['driverId'],
  additionalProperties: false,
  properties: { driverId: uuidSchema },
} as const;

export const signInResponseSchema = {
  type: 'object',
  required: ['token', 'driver'],
  additionalProperties: false,
  properties: { token: { type: 'string' }, driver: driverProfileSchema },
} as const;

export const currentDriverSchema = {
  type: 'object',
  required: ['id', 'firstName', 'acceptedNoticeVersion'],
  additionalProperties: false,
  properties: { ...driverProfileProperties, acceptedNoticeVersion: { type: ['string', 'null'] } },
} as const;

export const acceptNoticeBodySchema = {
  type: 'object',
  required: ['noticeVersion'],
  additionalProperties: false,
  properties: { noticeVersion: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

// An identity token is a JWT of a few hundred to a couple of thousand characters; anything longer is not one.
const identityTokenSchema = { type: 'string', minLength: 1, maxLength: 4096 } as const;
const nameSchema = { type: 'string', maxLength: 50 } as const;

export const googleSignInBodySchema = {
  type: 'object',
  required: ['identityToken'],
  additionalProperties: false,
  properties: { identityToken: identityTokenSchema },
} as const;

// Apple hands the name to the app only, on the first sign-in, so the app passes it along with the token.
export const appleSignInBodySchema = {
  type: 'object',
  required: ['identityToken'],
  additionalProperties: false,
  properties: { identityToken: identityTokenSchema, firstName: nameSchema, lastName: nameSchema },
} as const;

export const driverNameBodySchema = {
  type: 'object',
  required: ['firstName', 'lastName'],
  additionalProperties: false,
  properties: { firstName: { ...nameSchema, minLength: 1 }, lastName: nameSchema },
} as const;
