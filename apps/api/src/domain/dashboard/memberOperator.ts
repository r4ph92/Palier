import { DashboardRefusedError } from './DashboardRefusedError.ts';
import type { OperatorRepository } from './OperatorRepository.ts';

export interface MemberLot {
  readonly userId: string;
  readonly lotId: string;
}

export type MemberOperators = Pick<OperatorRepository, 'findOperatorOfMember'>;

// A member without an operator gets the same answer as anyone else on a lot that is not theirs.
export async function operatorIdOfMember(operators: MemberOperators, { userId }: MemberLot): Promise<string> {
  const operator = await operators.findOperatorOfMember(userId);
  if (operator === null) {
    throw new DashboardRefusedError('LOT_NOT_FOUND');
  }
  return operator.id;
}
