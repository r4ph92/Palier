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
  | 'release-spot-hold'
  | 'find-expired-hold-lots'
  | 'expire-spot-holds'
  | 'read-held-spot'
  | 'use-spot-hold'
  | 'has-usable-spot-hold'
  | 'assign-held-spot'
  | 'free-held-spot'
  | 'presume-parked'
  | 'read-unchanged-session'
  | 'read-walk-facts'
  | 'ask-where-parked'
  | 'flag-assigned-spot'
  | 'unknown';

export interface ExecutedStatement {
  readonly label: StatementLabel;
  readonly text: string;
  readonly params: readonly unknown[];
  readonly onTransaction: boolean;
}

export type Rows = readonly Record<string, unknown>[];

const dialect = new PgDialect();

// Checked in order: the claim also tests state = 'AVAILABLE', so it must match before the free-spot read.
const STATEMENT_PATTERNS: readonly (readonly [StatementLabel, RegExp])[] = [
  ['limit-lock-wait', /set local lock_timeout/],
  ['presume-parked', /set state = 'PARKED_PRESUMED'/],
  ['read-walk-facts', /left join aisle detected/],
  ['ask-where-parked', /set state = 'PARKED_UNCONFIRMED'/],
  ['flag-assigned-spot', /set state = 'OCCUPIED_UNKNOWN'/],
  ['read-unchanged-session', /select state, parked_at from parking_session/],
  ['lock-lot', /from parking_lot[\s\S]*for no key update/],
  ['read-active-session', /with active as/],
  ['assign-held-spot', /state = 'HELD' for update skip locked/],
  ['claim-spot', /for update skip locked/],
  ['read-free-spots', /s\.state = 'AVAILABLE'/],
  ['read-active-spot-hold', /from \(select id, lot_id, expires_at from spot_hold/],
  ['read-spot-hold-lot', /join operator on/],
  ['read-spot-hold-facts', /as active_holds_in_lot/],
  ['insert-spot-hold', /insert into spot_hold/],
  ['release-spot-hold', /update spot_hold set status = 'RELEASED'/],
  ['find-expired-hold-lots', /select distinct lot_id from spot_hold/],
  ['expire-spot-holds', /update spot_hold set status = 'EXPIRED'/],
  ['use-spot-hold', /update spot_hold set status = 'USED'/],
  ['read-held-spot', /from \(select id, spot_id from spot_hold/],
  ['has-usable-spot-hold', /select 1 from spot_hold/],
  ['free-held-spot', /update spot set/],
];

function labelOf(text: string): StatementLabel {
  return STATEMENT_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'unknown';
}

// Answers each statement with the next rows scripted for its label, and records every statement it ran.
export class ScriptedSql {
  readonly statements: ExecutedStatement[] = [];
  readonly isolationLevels: (string | undefined)[] = [];
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
      insert: () => ({ values: () => ({ returning: () => this.#record({ label: 'insert-session', text: '', params: [], onTransaction: true }) }) }),
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
