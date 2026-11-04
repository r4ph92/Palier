import type { KycStatus } from '@palier/shared-types';
import { OperatorStripeUnavailableError, type OperatorStripeAccounts, type OperatorStripeGateway } from '../../../src/domain/dashboard/OperatorStripe.ts';
import type { FakeOperatorRepository } from './fakeOperatorRepository.ts';

export const ONBOARDING_URL = 'https://connect.stripe.com/setup/e/acct_test/onboarding';

export class FakeOperatorStripeGateway implements OperatorStripeGateway {
  readonly createdFor: string[] = [];
  readonly linksFor: string[] = [];
  unavailable = false;

  createExpressAccount(operatorId: string): Promise<string> {
    this.#failWhenUnavailable();
    this.createdFor.push(operatorId);
    return Promise.resolve(`acct_${operatorId.slice(-12)}`);
  }

  createOnboardingLink(accountId: string): Promise<string> {
    this.#failWhenUnavailable();
    this.linksFor.push(accountId);
    return Promise.resolve(`${ONBOARDING_URL}?account=${accountId}`);
  }

  #failWhenUnavailable(): void {
    if (this.unavailable) {
      throw new OperatorStripeUnavailableError();
    }
  }
}

// Keeps the accounts beside the operators of the fake repository, and writes the status back there.
export class FakeOperatorStripeAccounts implements OperatorStripeAccounts {
  readonly #accountByOperator = new Map<string, string>();
  readonly #operators: FakeOperatorRepository;

  constructor(operators: FakeOperatorRepository) {
    this.#operators = operators;
  }

  findAccountId(operatorId: string): Promise<string | null> {
    return Promise.resolve(this.#accountByOperator.get(operatorId) ?? null);
  }

  saveAccountIfAbsent(operatorId: string, accountId: string): Promise<string> {
    const stored = this.#accountByOperator.get(operatorId);
    if (stored !== undefined) {
      return Promise.resolve(stored);
    }
    this.#accountByOperator.set(operatorId, accountId);
    this.#operators.setKycStatus(operatorId, 'PENDING');
    return Promise.resolve(accountId);
  }

  updateStatusOfAccount(accountId: string, status: KycStatus): Promise<boolean> {
    const operatorId = [...this.#accountByOperator].find(([, account]) => account === accountId)?.[0];
    if (operatorId === undefined) {
      return Promise.resolve(false);
    }
    this.#operators.setKycStatus(operatorId, status);
    return Promise.resolve(true);
  }

  // A test that needs an operator already connected to Stripe.
  connect(operatorId: string, accountId: string): void {
    this.#accountByOperator.set(operatorId, accountId);
  }
}
