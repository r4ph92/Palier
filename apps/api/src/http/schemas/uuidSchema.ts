// Fastify's `uuid` format also accepts a `urn:uuid:` prefix, which Postgres cannot read as a uuid.
export const uuidSchema = {
  type: 'string',
  pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
} as const;

export const idPathParametersSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: uuidSchema },
} as const;

