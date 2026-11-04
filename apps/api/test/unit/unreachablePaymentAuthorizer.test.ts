import { describe, expect, it } from 'vitest';
import { UnreachablePaymentAuthorizer } from '../../src/infrastructure/stripe/UnreachablePaymentAuthorizer.ts';

describe('UnreachablePaymentAuthorizer', () => {
  it('refuses every hold as payments unavailable', async () => {
    await expect(new UnreachablePaymentAuthorizer().authorize()).rejects.toMatchObject({ reason: 'PAYMENTS_UNAVAILABLE' });
  });

  it('answers a failed release, so the cancellation job keeps the hold pending and retries', async () => {
    await expect(new UnreachablePaymentAuthorizer().cancel()).resolves.toBe('failed');
  });
});
