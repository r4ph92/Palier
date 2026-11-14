import { describe, expect, it } from 'vitest';
import { lockAnsweredSpot } from '../../src/infrastructure/postgres/parkedAnswerStatements.ts';
import { readParkedQuestion } from '../../src/infrastructure/postgres/parkedQuestion.ts';
import { PostgresLotAvailabilityRepository } from '../../src/infrastructure/postgres/PostgresLotAvailabilityRepository.ts';
import { PostgresLevelOccupancyReader } from '../../src/infrastructure/postgres/PostgresLevelOccupancyReader.ts';
import { readFreeSpots, readFreeSpotsNoSessionHolds } from '../../src/infrastructure/postgres/spotClaim.ts';
import { changeSpotState } from '../../src/seed/changeSpotState.ts';
import { capturedSqlDatabase } from './fakes/capturedSql.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const LOT = 'lot-demo';
const noNeeds = { isElectric: false, hasAccessiblePermit: false, isOversize: false };

// A retired spot stays in the table for its history (decision 035): no reader may count it, offer it, hand it out or name it.
describe('readers that skip retired spots', () => {
  it('leaves them out of the free spots an entry, a hold or a spot-taken report may claim', async () => {
    const scripted = new ScriptedSql();

    await readFreeSpots(scripted.executor(), LOT);
    await readFreeSpotsNoSessionHolds(scripted.executor(), LOT);

    expect(scripted.statements.map(({ text }) => text).every((text) => /s\.state = 'AVAILABLE' and s\.retired_at is null/.test(text))).toBe(true);
  });

  it('leaves them out of the free spots counted in a driver’s lot list', async () => {
    const onlineLot = [LOT, 'Parking Démo', '45.5', '-73.5', 10, 0, 0, 0];
    const { database, statements } = capturedSqlDatabase((statementText) => (statementText.includes('"parking_lot"."is_online"') ? [onlineLot] : []));

    await new PostgresLotAvailabilityRepository(database).findOnlineLots(5);

    expect(statements.find((statementText) => statementText.includes('group by'))).toMatch(/"spot"\."state" = \$\d+ and "spot"\."retired_at" is null/);
  });

  it('leaves them out of the occupancy counts of each level', async () => {
    const scripted = new ScriptedSql();

    await new PostgresLevelOccupancyReader(scripted.database()).readLevelOccupancy('operator-lavoie', LOT);

    expect(scripted.statement('read-level-occupancy')?.text).toMatch(/left join spot on spot\.aisle_id = aisle\.id and spot\.retired_at is null/);
  });

  it('never names a retired spot in a driver’s answer, so a retired A-3 and a live A-3 are one number', async () => {
    const scripted = new ScriptedSql();

    await lockAnsweredSpot(scripted.executor(), { lotId: LOT, spotNumber: 'A-3' });

    expect(scripted.statement('lock-answered-spot')?.text).toMatch(/where spot\.lot_id = \$1 and spot\.retired_at is null and upper/);
  });

  it('never suggests a retired spot in the question about the aisle the driver walked to', async () => {
    const scripted = new ScriptedSql();

    await readParkedQuestion(scripted.database(), { aisleId: 'aisle-b', needs: noNeeds });

    expect(scripted.statement('read-parked-question')?.text).toMatch(/spot\.state = 'AVAILABLE' and spot\.retired_at is null/);
  });

  it('never changes a retired spot from the spot-state script', async () => {
    const { database, statements } = capturedSqlDatabase();

    await expect(changeSpotState(database, { lotName: 'Parking Démo', spotNumber: 'A-3', state: 'OCCUPIED', forceActiveSession: false })).rejects.toThrow('No spot A-3');

    expect(statements.find((statementText) => statementText.includes('for update'))).toMatch(/"spot"\."number" = \$\d+ and "spot"\."retired_at" is null/);
  });
});
