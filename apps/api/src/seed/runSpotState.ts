import { connectToDatabase } from '../infrastructure/postgres/database.ts';
import { activeSessionWarning } from './activeSessionRule.ts';
import { changeSpotState } from './changeSpotState.ts';
import { databaseUrlAllowedForSeeding } from './seedGuard.ts';
import { parseSpotStateArguments } from './spotStateArguments.ts';

const change = parseSpotStateArguments(process.argv.slice(2));
const connection = connectToDatabase(databaseUrlAllowedForSeeding(process.env));
try {
  const { activeSessionStillPoints } = await changeSpotState(connection.database, change);
  console.log(`${change.lotName} ${change.spotNumber} is now ${change.state}.`);
  if (activeSessionStillPoints) {
    console.log(activeSessionWarning(change));
  }
} finally {
  await connection.close();
}
