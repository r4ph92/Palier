import { signInDriver } from '../domain/drivers/driverSessions.ts';
import type { Database } from '../infrastructure/postgres/database.ts';
import { PostgresSessionTokenRepository } from '../infrastructure/postgres/PostgresSessionTokenRepository.ts';
import { PostgresUserDirectory } from '../infrastructure/postgres/PostgresUserDirectory.ts';
import { LOAD_DRIVER_IDS, LOAD_VEHICLE_NEEDS } from '../seed/fixtures/loadDrivers.ts';
import type { EntryLoadArguments } from './entryLoadArguments.ts';
import { checkRunSessions, countActiveSessionsOf, countAdmissibleSpots, databaseNow } from './entryLoadDatabase.ts';
import { reportEntryLoad, type EntryLoadReport } from './entryLoadReport.ts';
import { seededEntryGate } from './entryLoadTarget.ts';
import { fireEntries } from './fireEntries.ts';

export interface EntryLoadSetup {
  readonly database: Database;
  readonly options: EntryLoadArguments;
  readonly appVersion: string;
}

// Expected admissions are measured before firing, then every count is checked against the database afterwards.
export async function runEntryLoad({ database, options, appVersion }: EntryLoadSetup): Promise<EntryLoadReport> {
  const target = seededEntryGate(options.gateName);
  const driverIds = LOAD_DRIVER_IDS.slice(0, options.drivers);
  await refuseDriversAlreadyInside(database, driverIds);
  const expectedAdmissions = Math.min(driverIds.length, await countAdmissibleSpots(database, target.lotId, LOAD_VEHICLE_NEEDS));
  const tokens = await signInDrivers(database, driverIds);
  const since = await databaseNow(database);
  const outcomes = await fireEntries({ apiUrl: options.apiUrl, qrContent: target.qrContent, appVersion }, tokens);
  const sessions = await checkRunSessions(database, { lotId: target.lotId, driverIds, since });
  return reportEntryLoad({ expectedAdmissions, outcomes, database: sessions, maxLatencyMilliseconds: options.maxLatencyMilliseconds });
}

// A driver still inside from an earlier run would replay or be refused, not compete for a spot.
async function refuseDriversAlreadyInside(database: Database, driverIds: readonly string[]): Promise<void> {
  const inside = await countActiveSessionsOf(database, driverIds);
  if (inside > 0) {
    throw new Error(`${inside} load-test drivers still have an active session: reseed first (npm run seed --workspace @palier/api).`);
  }
}

// Tokens are written straight to the database: the test sign-in route only knows the app's personas and limits sign-ins per minute.
async function signInDrivers(database: Database, driverIds: readonly string[]): Promise<string[]> {
  const access = { users: new PostgresUserDirectory(database), sessions: new PostgresSessionTokenRepository(database) };
  const tokens: string[] = [];
  for (const driverId of driverIds) {
    const signedIn = await signInDriver(access, driverId);
    if (signedIn === null) {
      throw new Error(`Load-test driver ${driverId} is not in the database: reseed first (npm run seed --workspace @palier/api).`);
    }
    tokens.push(signedIn.token);
  }
  return tokens;
}
