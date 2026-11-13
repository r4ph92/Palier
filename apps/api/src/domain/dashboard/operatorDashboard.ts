import type { DashboardLot, DashboardOperator } from '@palier/shared-types';
import { isValidLegalName } from '@palier/shared-types/dashboard';
import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { NewOperator, OperatorRepository } from './OperatorRepository.ts';

export async function createOperator(repository: OperatorRepository, { userId, legalName }: NewOperator): Promise<DashboardOperator> {
  if (!isValidLegalName(legalName)) {
    throw new DashboardRefusedError('LEGAL_NAME_INVALID');
  }
  const created = await repository.createOperatorWithMember({ userId, legalName: legalName.trim() });
  if (created === null) {
    throw new DashboardRefusedError('OPERATOR_EXISTS');
  }
  return created;
}

export async function listLotsOfMember(repository: OperatorRepository, userId: string): Promise<readonly DashboardLot[]> {
  const operator = await repository.findOperatorOfMember(userId);
  if (operator === null) {
    throw new DashboardRefusedError('NO_OPERATOR');
  }
  return repository.listLotsOfOperator(operator.id);
}
