import type { Database } from '../infrastructure/postgres/database.ts';
import { PostgresSessionTokenRepository } from '../infrastructure/postgres/PostgresSessionTokenRepository.ts';
import { PostgresUserDirectory } from '../infrastructure/postgres/PostgresUserDirectory.ts';
import { LOAD_DRIVER_IDS, LOAD_VEHICLE_NEEDS } from '../seed/fixtures/loadDrivers.ts';
import type { EntryLoadArguments } from './entryLoadArguments.ts';
import { checkRunSessions, countActiveSessionsOf, countAdmissibleSpots, databaseNow } from './entryLoadDatabase.ts';
import { reportEntryLoad, type EntryLoadReport } from './entryLoadReport.ts';
import { seededEntryGate, type EntryLoadTarget } from './entryLoadTarget.ts';
import { fireEntries } from './fireEntries.ts';
import { LoadDriverTokens } from './loadDriverTokens.ts';

export interface EntryLoadSetup {
  readonly database: Database;
  readonly options: EntryLoadArguments;
  readonly appVersion: string;
}

interface EntryLoadPlan {
  readonly target: EntryLoadTarget;
  readonly driverIds: readonly string[];
  readonly expectedAdmissions: number;
}

export async function runEntryLoad(setup: EntryLoadSetup): Promise<EntryLoadReport> {
  const { database, options } = setup;
  const target = seededEntryGate(options.gateName);
  const driverIds = LOAD_DRIVER_IDS.slice(0, options.drivers);
  await refuseDriversAlreadyInside(database, driverIds);
  const expectedAdmissions = Math.min(driverIds.length, await countAdmissibleSpots(database, target.lotId, LOAD_VEHICLE_NEEDS));
  const tokens = new LoadDriverTokens({ users: new PostgresUserDirectory(database), sessions: new PostgresSessionTokenRepository(database) });
  try {
    return await fireAndCheck(setup, { target, driverIds, expectedAdmissions }, await tokens.signIn(driverIds));
  } finally {
    await revokeWithoutMasking(tokens);
  }
}

// A revoke failure must not replace the error of the run it follows.
async function revokeWithoutMasking(tokens: LoadDriverTokens): Promise<void> {
  try {
    await tokens.revokeAll();
  } catch (error) {
    console.error(`Could not revoke the load-test driver tokens: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fireAndCheck({ database, options, appVersion }: EntryLoadSetup, plan: EntryLoadPlan, tokens: readonly string[]): Promise<EntryLoadReport> {
  const since = await databaseNow(database);
  const outcomes = await fireEntries({ apiUrl: options.apiUrl, qrContent: plan.target.qrContent, appVersion }, tokens);
  const sessionCheck = await checkRunSessions(database, { lotId: plan.target.lotId, driverIds: plan.driverIds, since });
  return reportEntryLoad({ expectedAdmissions: plan.expectedAdmissions, outcomes, sessionCheck, maxLatencyMilliseconds: options.maxLatencyMilliseconds });
}

// A driver still inside from an earlier run would replay or be refused, not compete for a spot.
async function refuseDriversAlreadyInside(database: Database, driverIds: readonly string[]): Promise<void> {
  const inside = await countActiveSessionsOf(database, driverIds);
  if (inside > 0) {
    throw new Error(`${inside} load-test drivers still have an active session: reseed first (npm run seed --workspace @palier/api).`);
  }
}
