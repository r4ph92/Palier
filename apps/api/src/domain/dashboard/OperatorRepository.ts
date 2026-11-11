import type { DashboardLot, DashboardOperator } from '@palier/shared-types';

export interface NewOperator {
  readonly userId: string;
  readonly legalName: string;
}

// Every lot read names the operator, so a member only ever reaches the lots of their own operator.
export interface OperatorRepository {
  findOperatorOfMember(userId: string): Promise<DashboardOperator | null>;
  // Creates the operator and its first member together; null when the user already belongs to an operator.
  createOperatorWithMember(operator: NewOperator): Promise<DashboardOperator | null>;
  listLotsOfOperator(operatorId: string): Promise<readonly DashboardLot[]>;
}
