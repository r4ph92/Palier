import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PIERRE_ROY_ID, SOPHIE_LAVOIE_ID } from '../../src/config/testPersonas.ts';
import { buildServer } from '../../src/http/buildServer.ts';
import { ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';
import { fakeOperatorStripe, offlineStripe, WEBHOOK_SECRET } from './fakes/fakeOperatorStripe.ts';
import { fakeGateDependencies, fakeRepositories } from './fakes/serverDependencies.ts';

const ACCOUNT_ID = 'acct_1RoyTest';

function notification(type: string, account: object = {}): string {
  return JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object: { id: ACCOUNT_ID, object: 'account', ...account } } });
}

const verifiedAccount = { details_submitted: true, charges_enabled: true, payouts_enabled: true, requirements: { currently_due: [], past_due: [] } };
const dueAccount = { details_submitted: true, charges_enabled: false, payouts_enabled: false, requirements: { currently_due: ['individual.id_number'], past_due: [] } };

describe('the Stripe webhook', () => {
  let server: FastifyInstance;
  let operators: FakeOperatorRepository;

  afterEach(() => server.close());

  // Pierre's operator already owns the account, as after he started the onboarding.
  function start(withReader = true) {
    operators = new FakeOperatorRepository();
    const stripe = fakeOperatorStripe(operators);
    stripe.accounts.connect(ROY_OPERATOR_ID, ACCOUNT_ID);
    const operatorStripe = withReader ? stripe.dependencies : { ...stripe.dependencies, webhookReader: null };
    server = buildServer({ gates: fakeGateDependencies(), repositories: fakeRepositories({ operatorRepository: operators }), operatorStripe });
  }

  function post(payload: string, signature: string | undefined) {
    const headers = { 'content-type': 'application/json', ...(signature === undefined ? {} : { 'stripe-signature': signature }) };
    return server.inject({ method: 'POST', url: '/v1/stripe/webhook', headers, payload });
  }

  const signed = (payload: string, secret = WEBHOOK_SECRET) => offlineStripe.webhooks.generateTestHeaderString({ payload, secret });
  const statusOfRoy = async () => (await operators.findOperatorOfMember(PIERRE_ROY_ID))?.kycStatus;

  it('shows Pierre as verified once Stripe says the account is, with no action from him', async () => {
    start();
    const payload = notification('account.updated', verifiedAccount);

    const response = await post(payload, signed(payload));

    expect(response.statusCode).toBe(200);
    expect(await statusOfRoy()).toBe('VERIFIED');
  });

  it('shows Action required when Stripe reports information still due', async () => {
    start();
    const payload = notification('account.updated', dueAccount);

    await post(payload, signed(payload));

    expect(await statusOfRoy()).toBe('ACTION_REQUIRED');
  });

  it.each([
    ['a signature made with another secret', (payload: string) => signed(payload, 'whsec_attacker')],
    ['a signature that does not match the body', () => signed(notification('account.updated', dueAccount))],
    ['a malformed signature header', () => 'v1=abc'],
    ['no signature header', () => undefined],
  ])('rejects %s and changes no status', async (_case, signatureFor) => {
    start();
    const payload = notification('account.updated', verifiedAccount);

    const response = await post(payload, signatureFor(payload));

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'INVALID_SIGNATURE' });
    expect(await statusOfRoy()).toBe('NOT_STARTED');
  });

  it('rejects a body that is not JSON, signed or not', async () => {
    start();

    const response = await post('not json at all', signed('not json at all'));

    expect(response.statusCode).toBe(400);
    expect(await statusOfRoy()).toBe('NOT_STARTED');
  });

  it('accepts a signed update for an account no operator owns and changes no status', async () => {
    start();
    const payload = notification('account.updated', verifiedAccount).replace(ACCOUNT_ID, 'acct_stranger');

    const response = await post(payload, signed(payload));

    expect(response.statusCode).toBe(200);
    expect(await statusOfRoy()).toBe('NOT_STARTED');
    expect((await operators.findOperatorOfMember(SOPHIE_LAVOIE_ID))?.kycStatus).toBe('VERIFIED');
  });

  it('acknowledges a signed event of another type without touching any status', async () => {
    start();
    const payload = notification('payout.paid');

    const response = await post(payload, signed(payload));

    expect(response.statusCode).toBe(200);
    expect(await statusOfRoy()).toBe('NOT_STARTED');
  });

  it('has no webhook route without a signing secret', async () => {
    start(false);

    const response = await post('{}', undefined);

    expect(response.statusCode).toBe(404);
  });
});
