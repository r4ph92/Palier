import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DEFAULT_DATABASE_POOL_MAX } from '../../config/databasePool.ts';
import * as schema from './schema.ts';

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DatabaseConnection {
  readonly database: Database;
  close(): Promise<void>;
}

export function connectToDatabase(databaseUrl: string, poolMax: number = DEFAULT_DATABASE_POOL_MAX): DatabaseConnection {
  const client = postgres(databaseUrl, { max: poolMax, onnotice: () => undefined });
  return {
    database: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
