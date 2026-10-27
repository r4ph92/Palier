import { connectToDatabase } from '../infrastructure/postgres/database.ts';
import { changeSpotState } from './changeSpotState.ts';
import { databaseUrlAllowedForSeeding } from './seedGuard.ts';
import { parseSpotStateArguments } from './spotStateArguments.ts';

const change = parseSpotStateArguments(process.argv.slice(2));
const connection = connectToDatabase(databaseUrlAllowedForSeeding(process.env));
try {
  await changeSpotState(connection.database, change);
  console.log(`${change.lotName} ${change.spotNumber} is now ${change.state}.`);
} finally {
  await connection.close();
}
