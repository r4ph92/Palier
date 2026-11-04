import type { DashboardOperator } from '@palier/shared-types';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { OperatorRepository } from './OperatorRepository.ts';
import {
  kycStatusOf,
  OperatorStripeUnavailableError,
  type AccountSnapshot,
  type OperatorStripeAccounts,
  type OperatorStripeGateway,
} from './OperatorStripe.ts';

export interface OperatorStripeOnboarding {
  readonly operators: OperatorRepository;
  readonly accounts: OperatorStripeAccounts;
  readonly gateway: OperatorStripeGateway;
}

// The operator is the member's own: another operator's id and an unknown one give the same answer, so ids reveal nothing.
export async function findOwnOperator(operators: OperatorRepository, userId: string, operatorId: string): Promise<DashboardOperator> {
  const operator = await operators.findOperatorOfMember(userId);
  if (operator === null || operator.id !== operatorId) {
    throw new DashboardRefusedError('OPERATOR_NOT_FOUND');
  }
  return operator;
}

// Creates the Express account the first time and only issues a fresh link afterwards, so it also resumes an unfinished onboarding.
export async function startStripeOnboarding(
  { operators, accounts, gateway }: OperatorStripeOnboarding,
  userId: string,
  operatorId: string,
): Promise<string> {
  const operator = await findOwnOperator(operators, userId, operatorId);
  try {
    const accountId = (await accounts.findAccountId(operator.id)) ?? (await createAccount(accounts, gateway, operator));
    return await gateway.createOnboardingLink(accountId);
  } catch (error) {
    if (error instanceof OperatorStripeUnavailableError) {
      throw new DashboardRefusedError('STRIPE_UNAVAILABLE');
    }
    throw error;
  }
}

async function createAccount(accounts: OperatorStripeAccounts, gateway: OperatorStripeGateway, operator: DashboardOperator): Promise<string> {
  const created = await gateway.createExpressAccount(operator.id, operator.legalName);
  return accounts.saveAccountIfAbsent(operator.id, created);
}

// An account no operator owns changes nothing.
export async function applyAccountUpdate(accounts: OperatorStripeAccounts, snapshot: AccountSnapshot): Promise<boolean> {
  return accounts.updateStatusOfAccount(snapshot.accountId, kycStatusOf(snapshot));
}
