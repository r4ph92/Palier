import { asc, eq } from 'drizzle-orm';
import type { DashboardLot, DashboardOperator } from '@palier/shared-types';
import type { NewOperator, OperatorRepository } from '../../domain/dashboard/OperatorRepository.ts';
import type { Database } from './database.ts';
import { operator, operatorMember, parkingLot } from './schema.ts';
import { isUniqueViolationOf } from './uniqueViolation.ts';

const ONE_OPERATOR_PER_USER = new Set(['operator_member_pkey']);
const operatorColumns = { id: operator.id, legalName: operator.legalName, kycStatus: operator.kycStatus };
const lotColumns = { id: parkingLot.id, name: parkingLot.name, isOnline: parkingLot.isOnline };

export class PostgresOperatorRepository implements OperatorRepository {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findOperatorOfMember(userId: string): Promise<DashboardOperator | null> {
    const [found] = await this.#database
      .select(operatorColumns)
      .from(operatorMember)
      .innerJoin(operator, eq(operator.id, operatorMember.operatorId))
      .where(eq(operatorMember.userId, userId))
      .limit(1);
    return found ?? null;
  }

  // One transaction, so a refused membership leaves no operator behind.
  async createOperatorWithMember({ userId, legalName }: NewOperator): Promise<DashboardOperator | null> {
    try {
      return await this.#database.transaction(async (transaction) => {
        const [created] = await transaction.insert(operator).values({ legalName }).returning(operatorColumns);
        if (created === undefined) {
          throw new Error('Inserting the operator returned no row.');
        }
        await transaction.insert(operatorMember).values({ userId, operatorId: created.id });
        return created;
      });
    } catch (error) {
      if (isUniqueViolationOf(error, ONE_OPERATOR_PER_USER)) {
        return null;
      }
      throw error;
    }
  }

  listLotsOfOperator(operatorId: string): Promise<readonly DashboardLot[]> {
    return this.#database.select(lotColumns).from(parkingLot).where(eq(parkingLot.operatorId, operatorId)).orderBy(asc(parkingLot.name));
  }
}
