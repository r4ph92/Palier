import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Database, Transaction } from '../../../src/infrastructure/postgres/database.ts';
import { labelOf, type StatementLabel } from './statementLabels.ts';

// The labels a test scripts and inspects come with the fake that answers them.
export type { StatementLabel } from './statementLabels.ts';

export interface ExecutedStatement {
  readonly label: StatementLabel;
  readonly text: string;
  readonly params: readonly unknown[];
  readonly onTransaction: boolean;
  // Each database.transaction call (and each executor) gets its own number; null for a statement on the shared connection.
  readonly transactionNumber: number | null;
}

export type Rows = readonly Record<string, unknown>[];

// Parking Démo as seeded, answered to read-lot-occupancy: capacity 10, nobody inside, nothing held or admitted.
export const PARKING_DEMO_OCCUPANCY_ROW = { capacity: 10, vehicle_count: 0, held_spot_count: 0, assigned_spot_count: 0 };

// What Postgres raises when a lock wait passes lock_timeout.
export const LOCK_NOT_AVAILABLE = { code: '55P03' };

const dialect = new PgDialect();

// Answers each statement with the next rows scripted for its label, and records every statement it ran.
export class ScriptedSql {
  readonly statements: ExecutedStatement[] = [];
  readonly isolationLevels: (string | undefined)[] = [];
  readonly insertedSessions: unknown[] = [];
  readonly #answers = new Map<StatementLabel, Rows[]>();
  readonly #failures = new Map<StatementLabel, unknown>();
  #transactionCount = 0;

  answer(label: StatementLabel, ...rowLists: Rows[]): this {
    this.#answers.set(label, [...(this.#answers.get(label) ?? []), ...rowLists]);
    return this;
  }

  // Every statement with this label fails, like Postgres refusing it.
  fail(label: StatementLabel, error: unknown): this {
    this.#failures.set(label, error);
    return this;
  }

  labels(): StatementLabel[] {
    return this.statements.map(({ label }) => label);
  }

  // The first statement with this label, undefined when none ran.
  statement(label: StatementLabel): ExecutedStatement | undefined {
    return this.statements.find((statement) => statement.label === label);
  }

  // Every statement with this label, in the order they ran.
  statementsOf(label: StatementLabel): ExecutedStatement[] {
    return this.statements.filter((statement) => statement.label === label);
  }

  count(label: StatementLabel): number {
    return this.statements.filter((statement) => statement.label === label).length;
  }

  // The transaction numbers of every statement with this label, in the order they ran.
  transactionsOf(label: StatementLabel): (number | null)[] {
    return this.statements.filter((statement) => statement.label === label).map(({ transactionNumber }) => transactionNumber);
  }

  executor(): Pick<Transaction, 'execute'> {
    return this.#transaction() as unknown as Pick<Transaction, 'execute'>;
  }

  database(): Database {
    const database = {
      execute: (query: SQL) => this.#run(query, null),
      transaction: <T>(work: (tx: Transaction) => Promise<T>, config?: { isolationLevel?: string }) => {
        this.isolationLevels.push(config?.isolationLevel);
        return work(this.#transaction() as unknown as Transaction);
      },
    };
    return database as unknown as Database;
  }

  #transaction() {
    this.#transactionCount += 1;
    const transactionNumber = this.#transactionCount;
    return {
      execute: (query: SQL) => this.#run(query, transactionNumber),
      insert: () => ({
        values: (values: unknown) => {
          this.insertedSessions.push(values);
          return { returning: () => this.#record({ label: 'insert-session', text: '', params: [], onTransaction: true, transactionNumber }) };
        },
      }),
    };
  }

  #run(query: SQL, transactionNumber: number | null): Promise<Rows> {
    const { sql, params } = dialect.sqlToQuery(query);
    return this.#record({ label: labelOf(sql), text: sql, params, onTransaction: transactionNumber !== null, transactionNumber });
  }

  #record(statement: ExecutedStatement): Promise<Rows> {
    this.statements.push(statement);
    const failure = this.#failures.get(statement.label);
    if (failure !== undefined) {
      return Promise.reject(failure instanceof Error ? failure : new Error('Failed query', { cause: failure }));
    }
    return Promise.resolve(this.#answers.get(statement.label)?.shift() ?? []);
  }
}
