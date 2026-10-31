export const vehicleSchema = {
  type: 'object',
  required: ['id', 'plate', 'province'],
  additionalProperties: false,
  properties: { id: { type: 'string' }, plate: { type: 'string' }, province: { type: 'string' } },
} as const;

export const vehicleListSchema = { type: 'array', items: vehicleSchema } as const;

export const addVehicleBodySchema = {
  type: 'object',
  required: ['plate', 'province'],
  additionalProperties: false,
  properties: {
    plate: { type: 'string', maxLength: 64 },
    province: { type: 'string', minLength: 2, maxLength: 2 },
  },
} as const;

export const vehicleParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;
