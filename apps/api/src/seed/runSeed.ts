import { connectToDatabase } from '../infrastructure/postgres/database.ts';
import { databaseUrlAllowedForSeeding } from './seedGuard.ts';
import { seedDatabase } from './seedDatabase.ts';

const connection = connectToDatabase(databaseUrlAllowedForSeeding(process.env));
try {
  await seedDatabase(connection.database);
  console.log('Seeded Parking Démo and Garage Roy with their gates.');
} finally {
  await connection.close();
}
