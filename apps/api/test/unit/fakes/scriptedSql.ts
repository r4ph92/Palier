import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Database, Transaction } from '../../../src/infrastructure/postgres/database.ts';

export type StatementLabel =
  | 'limit-lock-wait'
  | 'lock-lot'
  | 'read-active-session'
  | 'read-free-spots'
  | 'claim-spot'
  | 'insert-session'
  | 'read-active-spot-hold'
  | 'read-spot-hold-lot'
  | 'read-spot-hold-facts'
  | 'insert-spot-hold'
  | 'unknown';

export interface ExecutedStatement {
  readonly label: StatementLabel;
  readonly params: readonly unknown[];
  readonly onTransaction: boolean;
}

type Rows = readonly Record<string, unknown>[];

const dialect = new PgDialect();

// Checked in order: the claim also tests state = 'AVAILABLE', so it must match before the free-spot read.
const STATEMENT_PATTERNS: readonly (readonly [StatementLabel, RegExp])[] = [
  ['limit-lock-wait', /set local lock_timeout/],
  ['lock-lot', /from parking_lot[\s\S]*for no key update/],
  ['read-active-session', /with active as/],
  ['claim-spot', /for update skip locked/],
  ['read-free-spots', /s\.state = 'AVAILABLE'/],
  ['read-active-spot-hold', /from \(select id, lot_id, expires_at from spot_hold/],
  ['read-spot-hold-lot', /join operator on/],
  ['read-spot-hold-facts', /as active_holds_in_lot/],
  ['insert-spot-hold', /insert into spot_hold/],
];

function labelOf(text: string): StatementLabel {
  return STATEMENT_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'unknown';
}

// Answers each statement with the next rows scripted for its label, and records every statement it ran.
export class ScriptedSql {
  readonly statements: ExecutedStatement[] = [];
  readonly isolationLevels: (string | undefined)[] = [];
  readonly #answers = new Map<StatementLabel, Rows[]>();

  answer(label: StatementLabel, ...rowLists: Rows[]): this {
    this.#answers.set(label, [...(this.#answers.get(label) ?? []), ...rowLists]);
    return this;
  }

  labels(): StatementLabel[] {
    return this.statements.map(({ label }) => label);
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
      insert: () => ({ values: () => ({ returning: () => this.#record('insert-session', [], true) }) }),
    };
  }

  #run(query: SQL, onTransaction: boolean): Promise<Rows> {
    const { sql, params } = dialect.sqlToQuery(query);
    return this.#record(labelOf(sql), params, onTransaction);
  }

  #record(label: StatementLabel, params: readonly unknown[], onTransaction: boolean): Promise<Rows> {
    this.statements.push({ label, params, onTransaction });
    return Promise.resolve(this.#answers.get(label)?.shift() ?? []);
  }
}
