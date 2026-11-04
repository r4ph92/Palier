import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { InvalidWebhookSignatureError } from '../../src/domain/dashboard/OperatorStripe.ts';
import { StripeAccountWebhookReader } from '../../src/infrastructure/stripe/StripeAccountWebhookReader.ts';

const SECRET = 'whsec_test_secret_for_unit_tests';
const stripe = new Stripe('sk_test_unit_tests_never_call_stripe');
const reader = new StripeAccountWebhookReader(stripe, SECRET);

function body(type: string, account: object): Buffer {
  return Buffer.from(JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object: { id: 'acct_1Roy', object: 'account', ...account } } }));
}

function signed(payload: Buffer, secret = SECRET): string {
  return stripe.webhooks.generateTestHeaderString({ payload: payload.toString(), secret });
}

describe('reading a Stripe notification', () => {
  it('reads an account update that carries a valid signature', () => {
    const payload = body('account.updated', {
      details_submitted: true,
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: ['individual.id_number'], past_due: [] },
    });

    expect(reader.read(payload, signed(payload))).toEqual({
      accountId: 'acct_1Roy',
      detailsSubmitted: true,
      chargesEnabled: false,
      payoutsEnabled: false,
      currentlyDue: ['individual.id_number'],
      pastDue: [],
    });
  });

  it('treats missing requirements as nothing due', () => {
    const payload = body('account.updated', { details_submitted: true, charges_enabled: true, payouts_enabled: true });

    expect(reader.read(payload, signed(payload))).toMatchObject({ currentlyDue: [], pastDue: [] });
  });

  it('ignores a signed event that is not an account update', () => {
    const payload = body('payout.paid', {});

    expect(reader.read(payload, signed(payload))).toBeNull();
  });

  it.each([
    ['no signature header', undefined],
    ['a signature that is not a Stripe header', 'not-a-signature'],
  ])('rejects %s', (_case, header) => {
    const payload = body('account.updated', {});

    expect(() => reader.read(payload, header)).toThrow(InvalidWebhookSignatureError);
  });

  it('rejects a signature made with another secret', () => {
    const payload = body('account.updated', {});

    expect(() => reader.read(payload, signed(payload, 'whsec_someone_else'))).toThrow(InvalidWebhookSignatureError);
  });

  it('rejects a body changed after it was signed', () => {
    const payload = body('account.updated', { charges_enabled: false });
    const header = signed(payload);

    expect(() => reader.read(body('account.updated', { charges_enabled: true }), header)).toThrow(InvalidWebhookSignatureError);
  });
});
