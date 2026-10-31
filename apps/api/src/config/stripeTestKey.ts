const TEST_KEY_PREFIX = 'sk_test_';

// Stripe is only ever called with a test key; a live key is refused so nothing real is charged.
export function stripeTestKey(variables: NodeJS.ProcessEnv): string | null {
  const key = variables['STRIPE_SECRET_KEY'];
  if (key === undefined || key === '') {
    return null;
  }
  if (!key.startsWith(TEST_KEY_PREFIX)) {
    throw new Error('Stripe key refused: STRIPE_SECRET_KEY must be a Stripe test key (sk_test_…).');
  }
  return key;
}
