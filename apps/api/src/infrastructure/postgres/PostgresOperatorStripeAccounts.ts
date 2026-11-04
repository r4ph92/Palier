import { and, eq, isNull } from 'drizzle-orm';
import type { KycStatus } from '@palier/shared-types';
import type { OperatorStripeAccounts } from '../../domain/dashboard/OperatorStripe.ts';
import type { Database } from './database.ts';
import { operator } from './schema.ts';

export class PostgresOperatorStripeAccounts implements OperatorStripeAccounts {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async findAccountId(operatorId: string): Promise<string | null> {
    const [found] = await this.#database.select({ accountId: operator.stripeAccountId }).from(operator).where(eq(operator.id, operatorId)).limit(1);
    return found?.accountId ?? null;
  }

  // One conditional update, so of two concurrent requests only the first stores its account and the second reads it back.
  async saveAccountIfAbsent(operatorId: string, accountId: string): Promise<string> {
    const [saved] = await this.#database
      .update(operator)
      .set({ stripeAccountId: accountId, kycStatus: 'PENDING' })
      .where(and(eq(operator.id, operatorId), isNull(operator.stripeAccountId)))
      .returning({ accountId: operator.stripeAccountId });
    const stored = saved?.accountId ?? (await this.findAccountId(operatorId));
    if (stored === null) {
      throw new Error('The operator to connect to Stripe does not exist.');
    }
    return stored;
  }

  async updateStatusOfAccount(accountId: string, status: KycStatus): Promise<boolean> {
    const updated = await this.#database.update(operator).set({ kycStatus: status }).where(eq(operator.stripeAccountId, accountId)).returning({ id: operator.id });
    return updated.length > 0;
  }
}
