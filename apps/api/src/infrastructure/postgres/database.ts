import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  readonly database: Database;
  close(): Promise<void>;
}

export function connectToDatabase(databaseUrl: string): DatabaseConnection {
  const client = postgres(databaseUrl, { max: 5, onnotice: () => undefined });
  return {
    database: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
