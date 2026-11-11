import { describe, expect, it } from 'vitest';
import { PostgresPassageLedger } from '../../src/infrastructure/postgres/PostgresPassageLedger.ts';
import { sortieDemo } from './fakes/gateFixtures.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const FIRST_ID = 'abcdef12-3456-4789-8abc-def123456789';
const SECOND_ID = '11111111-1111-4111-8111-111111111111';
const CLOSED_AT = new Date('2026-11-05T12:00:00Z');

function replayOf(scripted: ScriptedSql) {
  const passages = [
    { id: FIRST_ID, closedAt: CLOSED_AT },
    { id: SECOND_ID, closedAt: CLOSED_AT },
  ];
  return new PostgresPassageLedger(scripted.database()).recordReplay({ gate: sortieDemo, passages, vehicleCountChange: -1 });
}

describe('PostgresPassageLedger.recordReplay', () => {
  it('takes the lot lock before inserting, so opposite-order batches cannot deadlock', async () => {
    const scripted = new ScriptedSql().answer('replay-passages', [{ vehicle_count: 3, counted: 2 }]);

    await replayOf(scripted);

    expect(scripted.labels()).toEqual(['lock-lot', 'replay-passages']);
  });

  it('inserts each passage with its id and ignores one already recorded for the gate', async () => {
    const scripted = new ScriptedSql().answer('replay-passages', [{ vehicle_count: 3, counted: 2 }]);

    await replayOf(scripted);

    const statement = scripted.statement('replay-passages');
    expect(statement?.text).toContain('on conflict (gate_id, replay_id) do nothing');
    expect(statement?.params).toEqual(expect.arrayContaining([sortieDemo.id, FIRST_ID, SECOND_ID, CLOSED_AT.toISOString()]));
  });

  it('moves the counter by the change times the rows actually inserted', async () => {
    const scripted = new ScriptedSql().answer('replay-passages', [{ vehicle_count: 4, counted: 1 }]);

    const result = await replayOf(scripted);

    expect(result).toEqual({ counted: 1, duplicates: 1, vehicleCount: 4 });
    expect(scripted.statement('replay-passages')?.text).toContain('* (select count(*) from inserted)');
    expect(scripted.statement('replay-passages')?.params).toContain(-1);
  });

  it('reports a lot that no longer exists as a failure', async () => {
    await expect(replayOf(new ScriptedSql())).rejects.toThrow('The replay did not update any parking lot.');
  });

  it('runs in a read committed transaction, like the other lot-locked writes', async () => {
    const scripted = new ScriptedSql().answer('replay-passages', [{ vehicle_count: 3, counted: 2 }]);

    await replayOf(scripted);

    expect(scripted.isolationLevels).toEqual(['read committed']);
  });
});
