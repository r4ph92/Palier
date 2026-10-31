export const savedCardSchema = {
  type: 'object',
  required: ['brand', 'last4'],
  additionalProperties: false,
  properties: { brand: { type: 'string' }, last4: { type: 'string' } },
} as const;

export const paymentMethodResponseSchema = {
  type: 'object',
  required: ['card'],
  additionalProperties: false,
  properties: { card: { anyOf: [savedCardSchema, { type: 'null' }] } },
} as const;

export const setupIntentResponseSchema = {
  type: 'object',
  required: ['clientSecret'],
  additionalProperties: false,
  properties: { clientSecret: { type: 'string' } },
} as const;

export const savePaymentMethodBodySchema = {
  type: 'object',
  required: ['paymentMethodId'],
  additionalProperties: false,
  properties: { paymentMethodId: { type: 'string', pattern: '^pm_[A-Za-z0-9]{1,250}$' } },
} as const;
