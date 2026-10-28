import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readDatabaseUrl } from '../config/environment.ts';
import { connectToDatabase } from '../infrastructure/postgres/database.ts';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(databaseUrl: string): Promise<void> {
  const connection = connectToDatabase(databaseUrl);
  try {
    await migrate(connection.database, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await connection.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runMigrations(readDatabaseUrl(process.env));
  console.log('Migrations applied.');
}
