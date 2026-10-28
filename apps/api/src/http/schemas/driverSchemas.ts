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
  properties: { driverId: { type: 'string', format: 'uuid' } },
} as const;

export const signInResponseSchema = {
  type: 'object',
  required: ['token', 'driver'],
  additionalProperties: false,
  properties: { token: { type: 'string' }, driver: driverProfileSchema },
} as const;
