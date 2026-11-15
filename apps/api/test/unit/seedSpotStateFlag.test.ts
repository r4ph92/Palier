import { describe, expect, it } from 'vitest';
import { changeSpotState } from '../../src/seed/changeSpotState.ts';
import { capturedSqlDatabase } from './fakes/capturedSql.ts';

const LOCKED_SPOT = ['spot-a1'];
const NO_ACTIVE_SESSION = [0];

function databaseWithSpot() {
  return capturedSqlDatabase((statementText) => (statementText.includes('count(') ? [NO_ACTIVE_SESSION] : [LOCKED_SPOT]));
}

function updateOf(statements: readonly string[]): string {
  return statements.find((statementText) => statementText.startsWith('update "spot"')) ?? '';
}

describe('the spot-state script and the flag to check', () => {
  it('flags a spot it makes occupied-unknown, keeping the time of an earlier flag', async () => {
    const { database, statements } = databaseWithSpot();

    await changeSpotState(database, { lotName: 'Parking Démo', spotNumber: 'A-1', state: 'OCCUPIED_UNKNOWN', forceActiveSession: false });

    expect(updateOf(statements)).toMatch(/"needs_check" = \$\d+, "needs_check_since" = coalesce\("spot"\."needs_check_since", now\(\)\)/);
  });

  it('leaves the flag alone for any other state', async () => {
    const { database, statements } = databaseWithSpot();

    await changeSpotState(database, { lotName: 'Parking Démo', spotNumber: 'A-1', state: 'OUT_OF_SERVICE', forceActiveSession: false });

    expect(updateOf(statements)).not.toMatch(/needs_check/);
  });
});
