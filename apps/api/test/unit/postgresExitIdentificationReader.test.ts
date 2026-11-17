import { describe, expect, it } from 'vitest';
import { PostgresExitIdentificationReader } from '../../src/infrastructure/postgres/PostgresExitIdentificationReader.ts';
import { ScriptedSql } from './fakes/scriptedSql.ts';

const OPERATOR = 'operator-lavoie';
const LOT = 'lot-demo';
const SINCE = new Date('2026-10-17T12:00:00Z');

function readerOn(scripted: ScriptedSql) {
  return new PostgresExitIdentificationReader(scripted.database());
}

describe('the Postgres exit identification reader', () => {
  it('reads the lot in one statement scoped by lot and operator, from the cutoff, grouped by method', async () => {
    const scripted = new ScriptedSql().answer('read-exit-counts', []);

    await readerOn(scripted).readExitCounts(OPERATOR, LOT, SINCE);

    const read = scripted.statement('read-exit-counts');
    expect(scripted.labels()).toEqual(['read-exit-counts']);
    expect(read?.params).toEqual([SINCE.toISOString(), LOT, OPERATOR]);
    expect(read?.text).toMatch(/where parking_lot\.id = \$2 and parking_lot\.operator_id = \$3/);
    expect(read?.text).toMatch(/ps\.exit_at >= \$1::timestamptz/);
    expect(read?.text).toMatch(/ps\.exit_identification is not null/);
    expect(read?.text).toMatch(/group by parking_lot\.name, ps\.exit_identification/);
  });

  it('selects no column that names a driver, a vehicle or a payment', async () => {
    const scripted = new ScriptedSql().answer('read-exit-counts', []);

    await readerOn(scripted).readExitCounts(OPERATOR, LOT, SINCE);

    expect(scripted.statement('read-exit-counts')?.text).not.toMatch(/user_id|plate|payment|card_last4|vehicle_id/);
  });

  it('returns null when no row answers: an unknown lot or another operator\'s', async () => {
    expect(await readerOn(new ScriptedSql()).readExitCounts(OPERATOR, LOT, SINCE)).toBeNull();
  });

  it('reads a lot with no exit as zero for every method', async () => {
    const scripted = new ScriptedSql().answer('read-exit-counts', [{ lot_name: 'Parking Démo', exit_identification: null, exit_count: 0 }]);

    const read = await readerOn(scripted).readExitCounts(OPERATOR, LOT, SINCE);

    expect(read).toEqual({ lotName: 'Parking Démo', counts: { BEACON: 0, APP: 0, PLATE: 0, TRANSPONDER: 0 } });
  });

  it('fills the methods with no exit with zero', async () => {
    const scripted = new ScriptedSql().answer('read-exit-counts', [
      { lot_name: 'Parking Démo', exit_identification: 'BEACON', exit_count: 5 },
      { lot_name: 'Parking Démo', exit_identification: 'PLATE', exit_count: 2 },
    ]);

    const read = await readerOn(scripted).readExitCounts(OPERATOR, LOT, SINCE);

    expect(read?.counts).toEqual({ BEACON: 5, APP: 0, PLATE: 2, TRANSPONDER: 0 });
  });
});
