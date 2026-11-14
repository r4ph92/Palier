import { drizzle } from 'drizzle-orm/pg-proxy';
import type { Database } from '../../../src/infrastructure/postgres/database.ts';

export type RowsOfStatement = (statementText: string) => unknown[][];

// A Drizzle database whose driver only records the SQL text a query builder renders; rows come back in array mode.
// The proxy driver has no transactions, so a transaction runs its work on the same recorder.
export function capturedSqlDatabase(rowsOf: RowsOfStatement = () => []): { readonly database: Database; readonly statements: string[] } {
  const statements: string[] = [];
  const database = drizzle(async (statementText) => {
    statements.push(statementText);
    return { rows: rowsOf(statementText) };
  });
  const inOneTransaction = Object.assign(database, { transaction: <T>(work: (tx: typeof database) => Promise<T>) => work(database) });
  return { database: inOneTransaction as unknown as Database, statements };
}
