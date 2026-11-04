import { describe, expect, it } from 'vitest';
import { DashboardRefusedError } from '../../src/domain/dashboard/DashboardRefusedError.ts';
import { kycStatusOf, type AccountSnapshot } from '../../src/domain/dashboard/OperatorStripe.ts';
import { applyAccountUpdate, startStripeOnboarding } from '../../src/domain/dashboard/operatorStripeOnboarding.ts';
import { PIERRE_ROY_ID, SOPHIE_LAVOIE_ID } from '../../src/config/testPersonas.ts';
import { LAVOIE_OPERATOR_ID, ROY_OPERATOR_ID } from '../../src/seed/fixtures/operators.ts';
import { FakeOperatorRepository } from './fakes/fakeOperatorRepository.ts';
import { FakeOperatorStripeAccounts, FakeOperatorStripeGateway, ONBOARDING_URL } from './fakes/fakeOperatorStripe.ts';

const ACCOUNT_ID = 'acct_1RoyTest';
const verified: AccountSnapshot = {
  accountId: ACCOUNT_ID,
  detailsSubmitted: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  currentlyDue: [],
  pastDue: [],
};

function setup() {
  const operators = new FakeOperatorRepository();
  const accounts = new FakeOperatorStripeAccounts(operators);
  const gateway = new FakeOperatorStripeGateway();
  return { operators, accounts, gateway, onboarding: { operators, accounts, gateway } };
}

describe('the status Stripe reports', () => {
  it.each([
    ['everything is enabled and nothing is due', verified, 'VERIFIED'],
    ['details were submitted and Stripe is still checking them', { ...verified, chargesEnabled: false, payoutsEnabled: false }, 'PENDING'],
    ['details were submitted and information is currently due', { ...verified, chargesEnabled: false, currentlyDue: ['individual.id_number'] }, 'ACTION_REQUIRED'],
    ['details were submitted and information is past due', { ...verified, payoutsEnabled: false, pastDue: ['external_account'] }, 'ACTION_REQUIRED'],
    ['information is due but the onboarding was never finished', { ...verified, detailsSubmitted: false, chargesEnabled: false, currentlyDue: ['business_type'] }, 'PENDING'],
    ['payments are on but information is due again', { ...verified, currentlyDue: ['company.tax_id'] }, 'ACTION_REQUIRED'],
  ] as const)('is %s', (_case, snapshot, expected) => {
    expect(kycStatusOf(snapshot)).toBe(expected);
  });
});

describe('starting the Stripe onboarding', () => {
  it('creates the Express account for Pierre, marks it pending and returns the hosted link', async () => {
    const { onboarding, gateway, operators } = setup();

    const url = await startStripeOnboarding(onboarding, PIERRE_ROY_ID, ROY_OPERATOR_ID);

    expect(gateway.createdFor).toEqual([ROY_OPERATOR_ID]);
    expect(url.startsWith(ONBOARDING_URL)).toBe(true);
    expect((await operators.findOperatorOfMember(PIERRE_ROY_ID))?.kycStatus).toBe('PENDING');
  });

  it('resumes with a fresh link on the same account instead of creating another', async () => {
    const { onboarding, gateway } = setup();
    await startStripeOnboarding(onboarding, PIERRE_ROY_ID, ROY_OPERATOR_ID);

    await startStripeOnboarding(onboarding, PIERRE_ROY_ID, ROY_OPERATOR_ID);

    expect(gateway.createdFor).toHaveLength(1);
    expect(gateway.linksFor).toHaveLength(2);
    expect(new Set(gateway.linksFor).size).toBe(1);
  });

  it('keeps the account that won when two requests create one at the same time', async () => {
    const { onboarding, gateway } = setup();

    await Promise.all([
      startStripeOnboarding(onboarding, PIERRE_ROY_ID, ROY_OPERATOR_ID),
      startStripeOnboarding(onboarding, PIERRE_ROY_ID, ROY_OPERATOR_ID),
    ]);

    expect(new Set(gateway.linksFor).size).toBe(1);
  });

  it("gives Sophie not found for Pierre's operator, and Stripe is never called", async () => {
    const { onboarding, gateway } = setup();

    await expect(startStripeOnboarding(onboarding, SOPHIE_LAVOIE_ID, ROY_OPERATOR_ID)).rejects.toEqual(new DashboardRefusedError('OPERATOR_NOT_FOUND'));
    expect(gateway.createdFor).toEqual([]);
    expect(gateway.linksFor).toEqual([]);
  });

  it('gives a user with no operator not found', async () => {
    const { onboarding } = setup();

    await expect(startStripeOnboarding(onboarding, 'unknown-user', LAVOIE_OPERATOR_ID)).rejects.toEqual(new DashboardRefusedError('OPERATOR_NOT_FOUND'));
  });

  it('answers STRIPE_UNAVAILABLE and stores no account when Stripe cannot be reached', async () => {
    const { onboarding, gateway, operators } = setup();
    gateway.unavailable = true;

    await expect(startStripeOnboarding(onboarding, PIERRE_ROY_ID, ROY_OPERATOR_ID)).rejects.toEqual(new DashboardRefusedError('STRIPE_UNAVAILABLE'));
    expect((await operators.findOperatorOfMember(PIERRE_ROY_ID))?.kycStatus).toBe('NOT_STARTED');
  });
});

describe('applying an account update', () => {
  it('sets the status of the operator that owns the account', async () => {
    const { operators, accounts } = setup();
    accounts.connect(ROY_OPERATOR_ID, ACCOUNT_ID);

    const applied = await applyAccountUpdate(accounts, verified);

    expect(applied).toBe(true);
    expect((await operators.findOperatorOfMember(PIERRE_ROY_ID))?.kycStatus).toBe('VERIFIED');
  });

  it('changes nothing for an account no operator owns', async () => {
    const { operators, accounts } = setup();

    const applied = await applyAccountUpdate(accounts, { ...verified, accountId: 'acct_stranger' });

    expect(applied).toBe(false);
    expect((await operators.findOperatorOfMember(PIERRE_ROY_ID))?.kycStatus).toBe('NOT_STARTED');
  });
});
