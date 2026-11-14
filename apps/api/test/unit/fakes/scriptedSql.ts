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

  count(label: StatementLabel): number {
    return this.statements.filter((statement) => statement.label === label).length;
  }

  executor(): Pick<Transaction, 'execute'> {
    return this.#transaction() as unknown as Pick<Transaction, 'execute'>;
  }

  database(): Database {
    const database = {
      execute: (query: SQL) => this.#run(query, false),
      transaction: <T>(work: (tx: Transaction) => Promise<T>, config?: { isolationLevel?: string }) => {
        this.isolationLevels.push(config?.isolationLevel);
        return work(this.#transaction() as unknown as Transaction);
      },
    };
    return database as unknown as Database;
  }

  #transaction() {
    return {
      execute: (query: SQL) => this.#run(query, true),
      insert: () => ({
        values: (values: unknown) => {
          this.insertedSessions.push(values);
          return { returning: () => this.#record({ label: 'insert-session', text: '', params: [], onTransaction: true }) };
        },
      }),
    };
  }

  #run(query: SQL, onTransaction: boolean): Promise<Rows> {
    const { sql, params } = dialect.sqlToQuery(query);
    return this.#record({ label: labelOf(sql), text: sql, params, onTransaction });
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
